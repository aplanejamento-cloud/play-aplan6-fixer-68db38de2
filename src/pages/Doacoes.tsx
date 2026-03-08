import { useState, useRef } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMinhasDoacoes } from "@/hooks/usePremios";
import { useMediaUploadPremio } from "@/hooks/useMediaUploadPremio";
import AppHeader from "@/components/AppHeader";
import InviteButton from "@/components/InviteButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Loader2, Clock, CheckCircle2, Lock, Image as ImageIcon, MapPin, Ticket, Send, XCircle, Package } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/hooks/useIsAdmin";

// ─── Donor Ticket Verification with Likes Transfer ────────
const TicketVerifier = ({ doacaoId, doacaoUserId, likesRecebidos }: { doacaoId: string; doacaoUserId: string; likesRecebidos: number }) => {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const qc = useQueryClient();

  const handleVerify = async () => {
    if (code.length !== 6) { toast.error("Digite o código de 6 dígitos"); return; }
    setVerifying(true);
    setResult(null);
    try {
      // Find resgate by ticket code
      const { data: resgate, error: rErr } = await supabase
        .from("resgates")
        .select("*")
        .eq("codigo_ticket", code)
        .maybeSingle();

      if (rErr || !resgate) {
        setResult({ success: false, message: "Senha inválida" });
        toast.error("Senha inválida");
        setVerifying(false);
        return;
      }

      if (resgate.likes_transferidos) {
        setResult({ success: false, message: "Já transferido anteriormente" });
        toast.error("Já transferido");
        setVerifying(false);
        return;
      }

      const claimedUserId = (resgate as any).claimed_by_user_id || (resgate as any).usuario_id;
      const likesGastos = (resgate as any).likes_gastos || likesRecebidos;

      // Check claimed user has enough likes
      const { data: claimedUser } = await supabase
        .from("profiles")
        .select("total_likes, user_id")
        .eq("user_id", claimedUserId)
        .single();

      if (!claimedUser || (claimedUser as any).total_likes < likesGastos) {
        setResult({ success: false, message: "Usuário sem likes suficientes" });
        toast.error("Usuário sem likes suficientes");
        setVerifying(false);
        return;
      }

      // Get doador profile
      const { data: doador } = await supabase
        .from("profiles")
        .select("total_likes, user_id")
        .eq("user_id", doacaoUserId)
        .single();

      if (!doador) {
        setResult({ success: false, message: "Doador não encontrado" });
        setVerifying(false);
        return;
      }

      // Transfer likes: user -> doador
      await supabase.from("profiles")
        .update({ total_likes: (doador as any).total_likes + likesGastos })
        .eq("user_id", doacaoUserId);

      await supabase.from("profiles")
        .update({ total_likes: (claimedUser as any).total_likes - likesGastos })
        .eq("user_id", claimedUserId);

      // Mark resgate as transferred
      await supabase.from("resgates")
        .update({ likes_transferidos: true, status: "retirado" } as any)
        .eq("id", resgate.id);

      // Decrement stock now that doador verified
      const premioId = (resgate as any).premio_id;
      if (premioId) {
        const { data: premio } = await supabase.from("premios").select("estoque").eq("id", premioId).single();
        if (premio) {
          await supabase.from("premios").update({ estoque: Math.max(0, (premio as any).estoque - 1) }).eq("id", premioId);
        }
      }

      await supabase.from("doacoes_premios")
        .update({ verified_by_doador: true } as any)
        .eq("id", doacaoId);

      qc.invalidateQueries({ queryKey: ["minhas_doacoes"] });
      qc.invalidateQueries({ queryKey: ["premios"] });
      setResult({ success: true, message: `✅ Likes transferidos! +${likesGastos} likes para você.` });
      toast.success(`✅ Likes transferidos! Estoque -1`);
    } catch (e: any) {
      setResult({ success: false, message: e.message || "Erro ao verificar" });
      toast.error("Erro ao verificar ticket");
    }
    setVerifying(false);
  };

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-2">
        <Input
          placeholder="Senha 6 dígitos"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          maxLength={6}
          className="font-mono text-center text-lg tracking-widest"
        />
        <Button size="sm" onClick={handleVerify} disabled={verifying || code.length !== 6}>
          {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
      {result && (
        <p className={cn("text-xs font-medium", result.success ? "text-green-500" : "text-destructive")}>
          {result.message}
          {!result.success && result.message !== "Já transferido anteriormente" && (
            <span className="block text-destructive font-bold mt-1">⚠️ NÃO entregue o produto!</span>
          )}
        </p>
      )}
    </div>
  );
};

// ─── Donation Form ────────────────────────────────────────
const DonationForm = () => {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { upload, uploading } = useMediaUploadPremio();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [likesRecebidos, setLikesRecebidos] = useState(100);
  const [quantidade, setQuantidade] = useState(1);
  const [prateleira, setPrateleira] = useState<"1" | "2">("2");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [estado, setEstado] = useState("");
  const [cidade, setCidade] = useState("");
  const [bairro, setBairro] = useState("");
  const [endereco, setEndereco] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [videoUploading, setVideoUploading] = useState(false);

  const doarMutation = useMutation({
    mutationFn: async () => {
      if (!user || !selectedFile) throw new Error("Arquivo obrigatório");
      if (!whatsapp.trim()) throw new Error("WhatsApp é obrigatório");
      const url = await upload(selectedFile);
      if (!url) throw new Error("Falha no upload");
      const { error } = await supabase.from("doacoes_premios").insert({
        usuario_id: user.id, midia_url: url, titulo: titulo || null, descricao: descricao || null,
        likes_recebidos: likesRecebidos, tipo_prateleira: Number(prateleira), aprovado: false, quantidade,
        estado: estado || null, cidade: cidade || null, bairro: bairro || null,
        endereco: endereco || null, numero: numero || null, complemento: complemento || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["minhas_doacoes", user?.id] });
      setTitulo(""); setDescricao(""); setLikesRecebidos(100); setQuantidade(1);
      setPreviewUrl(null); setSelectedFile(null); setWhatsapp("");
      setEstado(""); setCidade(""); setBairro(""); setEndereco(""); setNumero(""); setComplemento("");
      toast.success("🎁 Doação enviada! Aguardando aprovação do admin.");
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao enviar doação"),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type.startsWith("video/")) setVideoUploading(true);
    setSelectedFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    if (f.type.startsWith("video/")) {
      setTimeout(() => setVideoUploading(false), 500);
    }
  };

  return (
    <Card className="p-4 space-y-4 border-primary/20">
      <div
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-border rounded-xl h-48 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors relative overflow-hidden"
      >
        {videoUploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Enviando vídeo... Aguarde</p>
          </div>
        ) : previewUrl ? (
          selectedFile?.type.startsWith("video/") ? (
            <video src={previewUrl} className="w-full h-full object-cover" muted />
          ) : (
            <img src={previewUrl} className="w-full h-full object-cover" alt="preview" />
          )
        ) : (
          <>
            <ImageIcon className="w-10 h-10 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Clique para selecionar foto ou vídeo</p>
          </>
        )}
        <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileChange} />
      </div>

      <Input placeholder="Título do prêmio (opcional)" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      <div>
        <Input placeholder="WhatsApp (11 99999-9999) *" type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className={whatsapp && !/^\d{2}\s?9?\d{4}-?\d{4}$/.test(whatsapp) ? "border-destructive" : !whatsapp.trim() ? "border-destructive/50" : ""} />
        {whatsapp && !/^\d{2}\s?9?\d{4}-?\d{4}$/.test(whatsapp) && (
          <p className="text-xs text-destructive mt-1">WhatsApp inválido (ex: 11 99999-9999)</p>
        )}
      </div>
      <Input placeholder="Descrição (opcional)" value={descricao} onChange={(e) => setDescricao(e.target.value)} />

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1 block">Likes que você quer receber</label>
          <Input type="number" min={1} value={likesRecebidos} onChange={(e) => setLikesRecebidos(Number(e.target.value))} />
        </div>
        <div className="w-28">
          <label className="text-xs text-muted-foreground mb-1 block">Quantidade</label>
          <Input type="number" min={1} value={quantidade} onChange={(e) => setQuantidade(Number(e.target.value))} />
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Prateleira</label>
        <Select value={prateleira} onValueChange={(v) => setPrateleira(v as "1" | "2")}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {isAdmin && <SelectItem value="1">🏆 Prêmios Maiores</SelectItem>}
            <SelectItem value="2">📍 Retirada Local Doador</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <MapPin className="w-4 h-4 text-primary" />
          Endereço para retirada
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input placeholder="Estado" value={estado} onChange={(e) => setEstado(e.target.value)} />
          <Input placeholder="Cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} />
          <Input placeholder="Bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} />
          <Input placeholder="Endereço (Rua)" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
          <Input placeholder="Número" value={numero} onChange={(e) => setNumero(e.target.value)} />
          <Input placeholder="Complemento" value={complemento} onChange={(e) => setComplemento(e.target.value)} />
        </div>
      </div>

      <p className="text-xs text-muted-foreground italic">💡 Doe um prêmio → receba likes quando aprovado e quando entregue ao usuário! Retire no endereço do doador.</p>

      <Button
        className="w-full font-cinzel font-bold"
        disabled={!selectedFile || !whatsapp.trim() || !/^\d{2}\s?9?\d{4}-?\d{4}$/.test(whatsapp) || doarMutation.isPending || uploading}
        onClick={() => doarMutation.mutate()}
      >
        {doarMutation.isPending || uploading ? (
          <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Enviando...</>
        ) : (
          <><Upload className="w-4 h-4 mr-2" /> Enviar Doação</>
        )}
      </Button>
    </Card>
  );
};

// ─── Main Page ────────────────────────────────────────────
const Doacoes = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: minhasDoacoes = [] } = useMinhasDoacoes(user?.id);

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-8 text-center">
        <Lock className="w-12 h-12 text-muted-foreground" />
        <p className="font-cinzel font-bold text-xl text-foreground">Faça login para doar prêmios</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      <AppHeader />
      <InviteButton />

      <div className="container mx-auto max-w-2xl px-4 pt-4 space-y-6">
        <div>
          <h1 className="font-cinzel font-bold text-2xl text-foreground">🎁 Doe um Prêmio</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Doe um prêmio → receba likes quando aprovado e quando entregue ao usuário! Retire no endereço do doador.
          </p>
        </div>

        <DonationForm />

        {minhasDoacoes.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-cinzel font-bold text-lg text-foreground">Minhas Doações</h2>
            {minhasDoacoes.map((d) => {
              const isApproved = d.aprovado;
              return (
                <Card key={d.id} className={cn(
                  "p-3 space-y-2 border-border",
                  isApproved && "border-primary/30"
                )}>
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                      {d.midia_url.match(/\.(mp4|webm|mov)$/i) ? (
                        <video src={d.midia_url} className="w-full h-full object-cover" muted />
                      ) : (
                        <img src={d.midia_url} alt="doação" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{d.titulo || "Sem título"}</p>
                      <p className="text-xs text-muted-foreground">{d.likes_recebidos} likes · {d.quantidade} un.</p>
                    </div>
                    {isApproved ? (
                      <Badge className="flex items-center gap-1 bg-primary/20 text-primary border-primary/30">
                        <CheckCircle2 className="w-3 h-3" /> Aprovada
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="w-3 h-3 animate-pulse" /> Aguardando
                      </Badge>
                    )}
                  </div>

                  {isApproved && (
                    <div className="border-t border-border pt-2 space-y-2">
                      <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                        <Ticket className="w-3 h-3" /> Verificar senha do usuário para entrega:
                      </p>
                      <TicketVerifier doacaoId={d.id} doacaoUserId={d.usuario_id} likesRecebidos={d.likes_recebidos} />
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-destructive border-destructive/30"
                        onClick={async () => {
                          if (!confirm("Remover este prêmio da prateleira?")) return;
                          await supabase.from("doacoes_premios").delete().eq("id", d.id);
                          if (d.titulo) {
                            await supabase.from("premios").delete().eq("titulo", d.titulo).eq("midia_url", d.midia_url);
                          }
                          qc.invalidateQueries({ queryKey: ["minhas_doacoes"] });
                          qc.invalidateQueries({ queryKey: ["premios"] });
                          toast.success("Prêmio removido da prateleira.");
                        }}
                      >
                        <XCircle className="w-4 h-4 mr-1" /> Remover da prateleira
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Doacoes;
