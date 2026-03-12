import { useGameState } from "@/hooks/useGameState";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { usePremios, useResgatarPremio, Premio } from "@/hooks/usePremios";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useRef, useMemo } from "react";
import { Gift, MapPin, Loader2, Lock, AlertTriangle, Ticket, Copy, CheckCircle2, Clock, XCircle, Volume2, VolumeX, Play, Pause, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import AppHeader from "@/components/AppHeader";
import InviteButton from "@/components/InviteButton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── City Filter (dynamic from premios data) ─────────────
const CityFilter = ({ filtroEstado, filtroCidade, setFiltroCidade }: {
  filtroEstado: string; filtroCidade: string; setFiltroCidade: (v: string) => void;
}) => {
  const { data: allPremios = [] } = usePremios();
  const cities = useMemo(() => {
    if (!filtroEstado || filtroEstado === "all") return [];
    const set = new Set<string>();
    allPremios.forEach((p) => {
      if (p.cidade && p.estado?.toLowerCase().includes(filtroEstado.toLowerCase())) {
        set.add(p.cidade);
      }
    });
    return Array.from(set).sort();
  }, [allPremios, filtroEstado]);

  if (filtroEstado === "all" || cities.length === 0) return null;

  return (
    <Select value={filtroCidade} onValueChange={setFiltroCidade}>
      <SelectTrigger className="flex-1">
        <SelectValue placeholder="Cidade" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todas as cidades</SelectItem>
        {cities.map((c) => (
          <SelectItem key={c} value={c}>{c}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
const PRATELEIRA_INFO = {
  1: { label: "🏆 Prêmios Maiores", icon: Gift, desc: "Troque seus likes por prêmios abaixo" },
  2: { label: "📍 Retirada Local Doador", icon: MapPin, desc: "Retire pessoalmente no endereço do doador" },
} as const;

const ESTADOS = [
  { value: "all", label: "Todos os estados" },
  { value: "SP", label: "São Paulo" },
  { value: "RJ", label: "Rio de Janeiro" },
  { value: "MG", label: "Minas Gerais" },
  { value: "BA", label: "Bahia" },
  { value: "RS", label: "Rio Grande do Sul" },
  { value: "PR", label: "Paraná" },
  { value: "SC", label: "Santa Catarina" },
  { value: "GO", label: "Goiás" },
  { value: "PE", label: "Pernambuco" },
  { value: "CE", label: "Ceará" },
  { value: "PA", label: "Pará" },
  { value: "ES", label: "Espírito Santo" },
];

const generateTicketCode = () => String(Math.floor(100000 + Math.random() * 900000));

// ─── Video with play/pause + mute ─────────────────────────
const VideoPlayer = ({ src, className }: { src: string; className?: string }) => {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!ref.current) return;
    if (playing) { ref.current.pause(); } else { ref.current.play(); }
    setPlaying(!playing);
  };
  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!ref.current) return;
    ref.current.muted = !muted;
    setMuted(!muted);
  };

  return (
    <div className="relative w-full h-full group">
      <video ref={ref} src={src} className={className} muted loop playsInline />
      <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={togglePlay} className="bg-background/70 rounded-full p-1">
          {playing ? <Pause className="w-4 h-4 text-foreground" /> : <Play className="w-4 h-4 text-foreground" />}
        </button>
        <button onClick={toggleMute} className="bg-background/70 rounded-full p-1">
          {muted ? <VolumeX className="w-4 h-4 text-foreground" /> : <Volume2 className="w-4 h-4 text-foreground" />}
        </button>
      </div>
    </div>
  );
};

// ─── Prize Card ───────────────────────────────────────────
const PrizeCard = ({ premio, userLikes, onResgatar, isRescuing }: {
  premio: Premio; userLikes: number; onResgatar: (p: Premio) => void; isRescuing: boolean;
}) => {
  const isFinalistOnly = !!(premio as any).finalist_only;
  const canAfford = isFinalistOnly || userLikes >= premio.likes_custo;
  const wouldEliminate = !isFinalistOnly && userLikes > 0 && userLikes - premio.likes_custo <= 0;
  const lowStock = premio.estoque < 5;
  const enderecoCompleto = [premio.endereco, premio.numero, premio.bairro, premio.cidade, premio.estado].filter(Boolean).join(", ");

  return (
    <div className="flex-shrink-0 w-[300px] rounded-2xl overflow-hidden border border-border bg-card shadow-lg flex flex-col">
      <div className="h-[200px] relative overflow-hidden bg-muted">
        {premio.midia_url ? (
          premio.midia_url.match(/\.(mp4|webm|mov)$/i) ? (
            <VideoPlayer src={premio.midia_url} className="w-full h-full object-cover" />
          ) : (
            <img src={premio.midia_url} alt={premio.titulo || "Prêmio"} className="w-full h-full object-cover" />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Gift className="w-16 h-16 text-muted-foreground" />
          </div>
        )}
        {lowStock && premio.estoque > 0 && (
          <Badge className="absolute top-2 right-2 bg-accent text-accent-foreground text-xs">
            ⚠️ Últimas {premio.estoque} un.
          </Badge>
        )}
        {premio.estoque === 0 && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <Badge variant="destructive" className="text-sm px-4 py-2">ESGOTADO</Badge>
          </div>
        )}
      </div>
      <div className="flex-1 p-4 flex flex-col gap-2">
        {isFinalistOnly && (
          <Badge className="bg-accent text-accent-foreground text-xs mb-1">🏆 Somente Para Finalista — ENTREGA MANUAL</Badge>
        )}
        {premio.titulo && <h3 className="font-montserrat font-bold text-foreground text-sm line-clamp-2">{premio.titulo}</h3>}
        {premio.descricao && <p className="text-xs text-muted-foreground line-clamp-2">{premio.descricao}</p>}
        {premio.quantidade > 1 && <p className="text-xs text-muted-foreground">Qtd: {premio.quantidade} unidades</p>}
        {enderecoCompleto && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {enderecoCompleto}
          </p>
        )}
        <div className="flex items-center justify-between mt-auto pt-2">
          <div>
            {isFinalistOnly ? (
              <p className="font-cinzel font-bold text-base text-primary">GRÁTIS p/ Finalista</p>
            ) : (
              <p className={cn("font-cinzel font-bold text-base", canAfford ? "text-primary" : "text-destructive")}>
                {premio.likes_custo.toLocaleString()} likes
              </p>
            )}
            <p className={cn("text-xs", lowStock && premio.estoque > 0 ? "text-accent-foreground" : "text-muted-foreground")}>
              Estoque: {premio.estoque}
            </p>
          </div>
          {premio.estoque > 0 && !isFinalistOnly && (
            <Button size="sm" onClick={() => onResgatar(premio)} disabled={isRescuing || !canAfford || wouldEliminate}
              className="font-cinzel font-bold" variant={canAfford && !wouldEliminate ? "default" : "outline"}>
              {isRescuing ? <Loader2 className="w-4 h-4 animate-spin" /> : wouldEliminate ? "JOGUE MAIS!" : canAfford ? "TROCAR" : "SEM SALDO"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Prateleira Section ───────────────────────────────────
const PrateleiraSection = ({ prateleira, userLikes, onResgatar, rescuingId, filtroEstado, filtroCidade }: {
  prateleira: 1 | 2; userLikes: number; onResgatar: (p: Premio) => void; rescuingId: string | null; filtroEstado: string; filtroCidade: string;
}) => {
  const { data: premios = [], isLoading } = usePremios(prateleira);
  const info = PRATELEIRA_INFO[prateleira];
  const availablePremios = premios.filter((p) => {
    // Show items with estoque 0 as "ESGOTADO" instead of hiding them
    if (filtroEstado && filtroEstado !== "all" && p.estado) {
      if (!p.estado.toLowerCase().includes(filtroEstado.toLowerCase())) return false;
    }
    if (filtroCidade && filtroCidade !== "all" && p.cidade) {
      if (!p.cidade.toLowerCase().includes(filtroCidade.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <section className="space-y-3">
      <div className="px-4">
        <h2 className="font-cinzel font-bold text-foreground text-lg flex items-center gap-2">{info.label}</h2>
        <p className="text-xs text-muted-foreground">{info.desc}</p>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : availablePremios.length === 0 ? (
        <div className="px-4 py-6 text-center text-muted-foreground text-sm">Nenhum prêmio disponível nesta prateleira</div>
      ) : (
        <div className="flex gap-4 overflow-x-auto px-4 pb-4 scrollbar-thin">
          {availablePremios.map((p) => (
            <PrizeCard key={p.id} premio={p} userLikes={userLikes} onResgatar={onResgatar} isRescuing={rescuingId === p.id} />
          ))}
        </div>
      )}
    </section>
  );
};

// ─── Ticket Card ──────────────────────────────────────────
const TicketCard = ({ resgate, premioData, onCancel }: { resgate: any; premioData?: any; onCancel?: (id: string) => void }) => {
  const copyCode = () => {
    navigator.clipboard.writeText(resgate.codigo_ticket || "");
    toast.success("Código copiado!");
  };

  const isVideo = premioData?.midia_url?.match(/\.(mp4|webm|mov)$/i);

  return (
    <Card className="p-3 space-y-2 border-primary/20">
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
          {premioData?.midia_url ? (
            isVideo ? (
              <video src={premioData.midia_url} className="w-full h-full object-cover" muted preload="metadata" />
            ) : (
              <img src={premioData.midia_url} alt={premioData.titulo || "Prêmio"} className="w-full h-full object-cover" />
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Ticket className="w-7 h-7 text-primary" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          {premioData?.titulo && <p className="text-sm font-semibold text-foreground truncate">{premioData.titulo}</p>}
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-lg text-primary">{resgate.codigo_ticket}</span>
            <button onClick={copyCode} className="text-muted-foreground hover:text-primary"><Copy className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            {resgate.status === "pendente" ? <Clock className="w-3 h-3 animate-pulse text-muted-foreground" /> : <CheckCircle2 className="w-3 h-3 text-primary" />}
            <span className="text-xs text-muted-foreground">{resgate.status === "pendente" ? "Aguardando retirada" : resgate.status}</span>
          </div>
          <p className="text-xs text-muted-foreground">{resgate.likes_gastos} likes gastos</p>
        </div>
      </div>
      {resgate.endereco_completo && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <MapPin className="w-3 h-3" /> {resgate.endereco_completo}
        </p>
      )}
      {(resgate as any).whatsapp_doador && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          📱 WhatsApp doador: <span className="font-medium text-foreground">{(resgate as any).whatsapp_doador}</span>
        </p>
      )}
      {resgate.status === "pendente" && onCancel && (
        <Button variant="outline" size="sm" className="w-full text-destructive border-destructive/30" onClick={() => onCancel(resgate.id)}>
          <XCircle className="w-4 h-4 mr-1" /> Cancelar troca
        </Button>
      )}
    </Card>
  );
};

// ─── Main Page ────────────────────────────────────────────
const Premios = () => {
  const { user } = useAuth();
  const { gameState } = useGameState();
  const { isAdmin } = useIsAdmin();
  const resgatar = useResgatarPremio();
  const [rescuingId, setRescuingId] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState("all");
  const [filtroCidade, setFiltroCidade] = useState("all");
  const [senhaModal, setSenhaModal] = useState<{ open: boolean; premio: Premio | null }>({ open: false, premio: null });
  const [senha, setSenha] = useState("");
  const [senhaError, setSenhaError] = useState("");
  const [senhaLoading, setSenhaLoading] = useState(false);
  const [showSenha, setShowSenha] = useState(false);
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile_likes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("total_likes").eq("user_id", user!.id).single();
      return data;
    },
  });

  const { data: meusResgates = [] } = useQuery({
    queryKey: ["meus_resgates", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resgates")
        .select("*, premios(id, titulo, midia_url)")
        .eq("usuario_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleCancelResgate = async (resgateId: string) => {
    try {
      const resgate = meusResgates.find((r: any) => r.id === resgateId);
      if (!resgate) return;
      await supabase.from("resgates").delete().eq("id", resgateId);
      const { data: prof } = await supabase.from("profiles").select("total_likes").eq("user_id", user!.id).single();
      if (prof) {
        await supabase.from("profiles").update({ total_likes: (prof.total_likes ?? 0) + (resgate.likes_gastos ?? 0) }).eq("user_id", user!.id);
      }
      qc.invalidateQueries({ queryKey: ["meus_resgates"] });
      qc.invalidateQueries({ queryKey: ["profile_likes"] });
      qc.invalidateQueries({ queryKey: ["premios"] });
      toast.success("Troca cancelada! Likes devolvidos.");
    } catch {
      toast.error("Erro ao cancelar");
    }
  };

  const userLikes = profile?.total_likes ?? 0;

  // Open modal instead of directly exchanging
  const handleResgatar = (premio: Premio) => {
    if (!user) return;
    if (userLikes < premio.likes_custo) { toast.error("Não tem likes suficientes!"); return; }
    if (userLikes - premio.likes_custo === 0) { toast.error("⚠️ Ganhe mais likes antes! Ficar com 0 likes te elimina do jogo por 3 dias."); return; }
    setSenha("");
    setSenhaError("");
    setShowSenha(false);
    setSenhaModal({ open: true, premio });
  };

  // Confirm exchange with password verification
  const handleConfirmTroca = async () => {
    if (!user || !senhaModal.premio) return;
    if (!senha.trim()) { setSenhaError("Digite sua senha"); return; }
    setSenhaLoading(true);
    setSenhaError("");
    try {
      // Verify password by trying to sign in
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: senha,
      });
      if (authError) {
        setSenhaError("Senha incorreta");
        setSenhaLoading(false);
        return;
      }
      // Password correct — proceed with exchange
      const premio = senhaModal.premio;
      const ticketCode = generateTicketCode();
      const enderecoCompleto = [premio.endereco, premio.numero, premio.bairro, premio.cidade, premio.estado].filter(Boolean).join(", ");
      setRescuingId(premio.id);
      setSenhaModal({ open: false, premio: null });
      await resgatar.mutateAsync({ premioId: premio.id, userId: user.id, likesCusto: premio.likes_custo, codigoTicket: ticketCode, enderecoCompleto: enderecoCompleto || null });
      toast.success(`🎫 Seu Ticket Retirada: ${ticketCode}`, { duration: 10000 });
      setRescuingId(null);
    } catch {
      toast.error("Erro ao trocar prêmio");
      setRescuingId(null);
    }
    setSenhaLoading(false);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-8 text-center">
        <Lock className="w-12 h-12 text-muted-foreground" />
        <p className="text-foreground font-cinzel font-bold text-xl">Faça login para ver os prêmios</p>
      </div>
    );
  }

  if (gameState && !gameState.game_on) {
    return (
      <>
        <AppHeader />
        <InviteButton />
        <div className="container mx-auto max-w-2xl px-4 py-12 text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-primary mx-auto" />
          <h1 className="font-cinzel font-bold text-2xl text-foreground">Jogo ainda não iniciado</h1>
          <p className="text-muted-foreground">Os prêmios estarão disponíveis quando o jogo começar.</p>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      <AppHeader />
      <InviteButton />

      <div className="container mx-auto max-w-2xl pt-4 space-y-8">
        <div className="mx-4 space-y-2">
          <p className="text-sm text-foreground font-medium">🎁 Trocar likes por prêmios abaixo</p>
          <p className="text-xs text-destructive font-bold">⚠️ RETIRE no endereço INFORMANDO A SENHA. NÃO informe a senha sem retirar o produto!</p>
          <p className="text-xs text-muted-foreground">📍 Retire no endereço do doador (não necessariamente em Guarujá).</p>
          {userLikes === 0 && <p className="text-xs text-destructive font-bold">⚔️ Jogue mais! Você está com 0 likes e eliminado.</p>}
        </div>

        <Card className="mx-4 p-4 flex items-center justify-between border-primary/30 bg-card/80">
          <div>
            <p className="text-xs text-muted-foreground">Seu saldo</p>
            <p className="font-cinzel font-bold text-2xl text-primary">{userLikes.toLocaleString()} likes</p>
          </div>
          <Gift className="w-8 h-8 text-primary/60" />
        </Card>

        {/* Filtro por estado + cidade */}
        <div className="mx-4 flex gap-3">
          <Select value={filtroEstado} onValueChange={(v) => { setFiltroEstado(v); setFiltroCidade("all"); }}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              {ESTADOS.map((e) => (
                <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <CityFilter filtroEstado={filtroEstado} filtroCidade={filtroCidade} setFiltroCidade={setFiltroCidade} />
        </div>

        {isAdmin && (
          <PrateleiraSection prateleira={1} userLikes={userLikes} onResgatar={handleResgatar} rescuingId={rescuingId} filtroEstado={filtroEstado} filtroCidade={filtroCidade} />
        )}
        <PrateleiraSection prateleira={2} userLikes={userLikes} onResgatar={handleResgatar} rescuingId={rescuingId} filtroEstado={filtroEstado} filtroCidade={filtroCidade} />

        {meusResgates.length > 0 && (
          <section className="space-y-3 px-4">
            <h2 className="font-cinzel font-bold text-foreground text-lg flex items-center gap-2">
              <Ticket className="w-5 h-5" /> Prêmios Escolhidos
            </h2>
            <p className="text-xs text-destructive font-bold">⚠️ RETIRE no endereço INFORMANDO A SENHA. NÃO informe a senha sem retirar o produto!</p>
            {meusResgates.map((r: any) => (
              <TicketCard key={r.id} resgate={r} premioData={r.premios} onCancel={handleCancelResgate} />
            ))}
          </section>
        )}
      </div>

      {/* Password confirmation modal */}
      <Dialog open={senhaModal.open} onOpenChange={(open) => { if (!open) setSenhaModal({ open: false, premio: null }); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-cinzel text-foreground">Confirmar Troca</DialogTitle>
            <DialogDescription>
              Trocar <span className="font-bold text-primary">{senhaModal.premio?.likes_custo} likes</span> por{" "}
              <span className="font-bold">{senhaModal.premio?.titulo || "prêmio"}</span>?
              Digite sua senha para confirmar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="relative">
              <Input
                type={showSenha ? "text" : "password"}
                placeholder="Sua senha"
                value={senha}
                onChange={(e) => { setSenha(e.target.value); setSenhaError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleConfirmTroca(); }}
                className={senhaError ? "border-destructive" : ""}
              />
              <button
                type="button"
                onClick={() => setShowSenha(!showSenha)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {senhaError && <p className="text-sm text-destructive font-medium">{senhaError}</p>}
          </div>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setSenhaModal({ open: false, premio: null })} disabled={senhaLoading}>
              CANCELAR
            </Button>
            <Button onClick={handleConfirmTroca} disabled={senhaLoading}>
              {senhaLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              CONFIRMAR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Premios;
