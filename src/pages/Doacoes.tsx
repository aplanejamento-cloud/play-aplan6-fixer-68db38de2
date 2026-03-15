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
import { sendWhatsAppDoador } from "@/services/WhatsAppService";
import { ESTADOS_BR, CIDADES_BR } from "@/data/estadosCidades";
import TicketVerifier from "@/components/doacoes/TicketVerifier";

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

  const cidadesDoEstado = estado ? (CIDADES_BR[estado] || []) : [];

  const doarMutation = useMutation({
    mutationFn: async () => {
      if (!user || !selectedFile) throw new Error("Arquivo obrigatório");
      if (!titulo.trim()) throw new Error("Título é obrigatório");
      if (!descricao.trim()) throw new Error("Descrição é obrigatória");
      if (!whatsapp.trim() || !/^\d{2}\s?9?\d{4}-?\d{4}$/.test(whatsapp)) throw new Error("WhatsApp inválido");
      if (!estado) throw new Error("Selecione o estado");
      if (!cidade) throw new Error("Selecione a cidade");
      if (!bairro.trim()) throw new Error("Bairro é obrigatório");
      if (!endereco.trim()) throw new Error("Endereço é obrigatório");
      if (!numero.trim()) throw new Error("Número é obrigatório");
      if (likesRecebidos < 1) throw new Error("Likes deve ser no mínimo 1");
      if (quantidade < 1) throw new Error("Quantidade deve ser no mínimo 1");

      const url = await upload(selectedFile);
      if (!url) throw new Error("Falha no upload");
      const { error } = await supabase.from("doacoes_premios").insert({
        usuario_id: user.id, midia_url: url, titulo, descricao,
        likes_recebidos: likesRecebidos, tipo_prateleira: Number(prateleira), aprovado: false, quantidade,
        estado, cidade, bairro,
        endereco, numero, complemento: complemento || null,
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

  const isFormValid = !!selectedFile && !!titulo.trim() && !!descricao.trim() && !!whatsapp.trim() && /^\d{2}\s?9?\d{4}-?\d{4}$/.test(whatsapp) && !!estado && !!cidade && !!bairro.trim() && !!endereco.trim() && !!numero.trim();

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

      <Input placeholder="Título do prêmio *" value={titulo} onChange={(e) => setTitulo(e.target.value)} className={!titulo.trim() ? "border-destructive/50" : ""} />
      <Input placeholder="Descrição *" value={descricao} onChange={(e) => setDescricao(e.target.value)} className={!descricao.trim() ? "border-destructive/50" : ""} />
      <div>
        <Input placeholder="WhatsApp (11 99999-9999) *" type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className={whatsapp && !/^\d{2}\s?9?\d{4}-?\d{4}$/.test(whatsapp) ? "border-destructive" : !whatsapp.trim() ? "border-destructive/50" : ""} />
        {whatsapp && !/^\d{2}\s?9?\d{4}-?\d{4}$/.test(whatsapp) && (
          <p className="text-xs text-destructive mt-1">WhatsApp inválido (ex: 11 99999-9999)</p>
        )}
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1 block">Likes que você quer receber *</label>
          <Input type="number" min={1} value={likesRecebidos} onChange={(e) => setLikesRecebidos(Number(e.target.value))} />
        </div>
        <div className="w-28">
          <label className="text-xs text-muted-foreground mb-1 block">Quantidade *</label>
          <Input type="number" min={1} value={quantidade} onChange={(e) => setQuantidade(Number(e.target.value))} />
        </div>
      </div>

      {isAdmin && (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Prateleira</label>
          <Select value={prateleira} onValueChange={(v) => setPrateleira(v as "1" | "2")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">🏆 Prêmios Maiores</SelectItem>
              <SelectItem value="2">📍 Retirada Local Doador</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-3 border-t border-border pt-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <MapPin className="w-4 h-4 text-primary" />
          Endereço para retirada
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Estado *</label>
            <Select value={estado} onValueChange={(v) => { setEstado(v); setCidade(""); }}>
              <SelectTrigger className={!estado ? "border-destructive/50" : ""}>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {ESTADOS_BR.map((e) => (
                  <SelectItem key={e.uf} value={e.uf}>{e.uf} - {e.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Cidade *</label>
            <Select value={cidade} onValueChange={setCidade} disabled={!estado}>
              <SelectTrigger className={!cidade && estado ? "border-destructive/50" : ""}>
                <SelectValue placeholder={estado ? "Selecione" : "Escolha estado"} />
              </SelectTrigger>
              <SelectContent>
                {cidadesDoEstado.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input placeholder="Bairro *" value={bairro} onChange={(e) => setBairro(e.target.value)} className={!bairro.trim() ? "border-destructive/50" : ""} />
          <Input placeholder="Endereço (Rua) *" value={endereco} onChange={(e) => setEndereco(e.target.value)} className={!endereco.trim() ? "border-destructive/50" : ""} />
          <Input placeholder="Número *" value={numero} onChange={(e) => setNumero(e.target.value)} className={!numero.trim() ? "border-destructive/50" : ""} />
          <Input placeholder="Complemento (opcional)" value={complemento} onChange={(e) => setComplemento(e.target.value)} />
        </div>
      </div>

      <p className="text-xs text-muted-foreground italic">💡 Doe um prêmio → receba likes quando aprovado e quando entregue ao usuário! Retire no endereço do doador.</p>
      <p className="text-xs text-destructive/70">* Campos obrigatórios (exceto complemento)</p>

      <Button
        className="w-full font-cinzel font-bold"
        disabled={!isFormValid || doarMutation.isPending || uploading}
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
                        <CheckCircle2 className="w-3 h-3" /> Aprovado
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
