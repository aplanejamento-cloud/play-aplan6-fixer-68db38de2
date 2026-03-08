import { useState, useEffect, useCallback } from "react";
import AppHeader from "@/components/AppHeader";
import InviteButton from "@/components/InviteButton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMinhasCompras } from "@/hooks/useComprasPix";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Heart, Copy, Check, Clock, CheckCircle, XCircle, Zap, Crown, Sparkles, Loader2, QrCode } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const PACOTES_TURBO = [
  { tipo: "turbo", likes: 0, valor: 19.9, label: "🔥 Turbo Likes x10", desc: "7 dias — cada like vale 10!", best: true, icon: Zap },
  { tipo: "turbo_bomba", likes: 0, valor: 29.9, label: "💣 Turbo Bombas x10", desc: "7 dias — juízes: bombas x10", icon: Sparkles },
  { tipo: "premium", likes: 0, valor: 9.9, label: "🏆 Premium 30 dias", desc: "Badge exclusivo + destaque no feed", icon: Crown },
];

const PACOTES_LIKES = [
  { tipo: "likes", likes: 100, valor: 10, label: "100 Likes", desc: "Pacote Starter" },
  { tipo: "likes", likes: 500, valor: 40, label: "500 Likes", desc: "Pacote Popular", best: true },
  { tipo: "likes", likes: 1000, valor: 70, label: "1.000 Likes", desc: "Pacote Premium" },
];

const ComprarLikes = () => {
  const [selectedTurbo, setSelectedTurbo] = useState<number | null>(null);
  const [selectedLikes, setSelectedLikes] = useState<number | null>(null);
  const [pixData, setPixData] = useState<{ qr_code: string; qr_code_base64: string; payment_id: string; compra_id: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [polling, setPolling] = useState(false);
  const [copied, setCopied] = useState(false);
  const { data: minhasCompras = [] } = useMinhasCompras();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["my-profile-turbo", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("multiplicador_ativo, multiplicador_end, premium_active, premium_end")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const turboActive = profile?.multiplicador_end && new Date(profile.multiplicador_end) > new Date() && (profile.multiplicador_ativo ?? 1) > 1;
  const premiumActive = profile?.premium_active && profile?.premium_end && new Date(profile.premium_end) > new Date();

  const selected = selectedTurbo !== null ? { ...PACOTES_TURBO[selectedTurbo], source: "turbo" as const }
    : selectedLikes !== null ? { ...PACOTES_LIKES[selectedLikes], source: "likes" as const }
    : null;

  const handleSelect = (type: "turbo" | "likes", index: number) => {
    if (type === "turbo") {
      setSelectedTurbo(index);
      setSelectedLikes(null);
    } else {
      setSelectedLikes(index);
      setSelectedTurbo(null);
    }
    setPixData(null);
    setPolling(false);
  };

  // Generate PIX QR via edge function
  const handleGerarPix = async () => {
    if (!selected || !user) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-pix-payment", {
        body: { tipo: selected.tipo, valor: selected.valor, likes: selected.likes },
      });
      if (error) throw error;
      setPixData(data);
      setPolling(true);
      toast.success("QR Code PIX gerado! Escaneie para pagar.");
    } catch (e: any) {
      console.error("Erro ao gerar PIX:", e);
      toast.error("Erro ao gerar PIX: " + (e.message || "tente novamente"));
    } finally {
      setGenerating(false);
    }
  };

  // Poll for payment approval + auto-credit likes
  const checkApproval = useCallback(async () => {
    if (!user || !polling || !pixData?.compra_id) return;
    const { data } = await supabase
      .from("compras_pix")
      .select("status, likes_adquiridos, tipo")
      .eq("id", pixData.compra_id)
      .single();

    if (data?.status === "aprovado") {
      // Auto-credit likes
      const likesToAdd = data.likes_adquiridos || 0;
      if (likesToAdd > 0) {
        const { data: currentProfile } = await supabase
          .from("profiles")
          .select("total_likes")
          .eq("user_id", user.id)
          .single();
        const newLikes = (currentProfile?.total_likes || 0) + likesToAdd;
        await supabase.from("profiles").update({ total_likes: newLikes }).eq("user_id", user.id);
      }

      // Handle turbo/premium activation
      if (data.tipo === "turbo" || data.tipo === "turbo_bomba") {
        const end = new Date();
        end.setDate(end.getDate() + 7);
        await supabase.from("profiles").update({
          multiplicador_ativo: data.tipo === "turbo_bomba" ? 10 : 10,
          multiplicador_end: end.toISOString(),
        }).eq("user_id", user.id);
      }
      if (data.tipo === "premium" || data.tipo === "renovacao") {
        const end = new Date();
        end.setDate(end.getDate() + 30);
        await supabase.from("profiles").update({
          premium_active: true,
          premium_end: end.toISOString(),
        }).eq("user_id", user.id);
      }

      setPolling(false);
      setPixData(null);
      setSelectedTurbo(null);
      setSelectedLikes(null);
      queryClient.invalidateQueries({ queryKey: ["compras-pix"] });
      queryClient.invalidateQueries({ queryKey: ["my-profile-turbo"] });
      toast.success(`✅ PIX aprovado! +${likesToAdd} likes adicionados!`);
    }
  }, [user, polling, pixData, queryClient]);

  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(checkApproval, 5000);
    return () => clearInterval(interval);
  }, [polling, checkApproval]);

  const handleCopyQR = () => {
    if (!pixData?.qr_code) return;
    navigator.clipboard.writeText(pixData.qr_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Código PIX copiado!");
  };

  const statusIcon = (s: string) => {
    if (s === "aprovado") return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (s === "rejeitado") return <XCircle className="w-4 h-4 text-destructive" />;
    return <Clock className="w-4 h-4 text-yellow-500" />;
  };

  const tipoLabel = (tipo: string) => {
    if (tipo === "turbo") return "🔥 Turbo x10";
    if (tipo === "turbo_bomba") return "💣 Turbo Bomba";
    if (tipo === "premium") return "🏆 Premium";
    return "❤️ Likes";
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <InviteButton />
      <main className="container mx-auto px-4 py-6 max-w-lg space-y-6">
        <h1 className="font-cinzel text-2xl text-primary text-center">💰 Loja PlayLike</h1>

        {/* Status badges */}
        {(turboActive || premiumActive) && (
          <div className="flex gap-2 justify-center flex-wrap">
            {turboActive && (
              <span className="bg-primary/20 text-primary text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                <Zap className="w-3 h-3" /> Turbo x{profile?.multiplicador_ativo} ativo até {new Date(profile!.multiplicador_end!).toLocaleDateString("pt-BR")}
              </span>
            )}
            {premiumActive && (
              <span className="bg-yellow-500/20 text-yellow-500 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                <Crown className="w-3 h-3" /> Premium até {new Date(profile!.premium_end!).toLocaleDateString("pt-BR")}
              </span>
            )}
          </div>
        )}

        {/* Turbo & Premium */}
        <div className="space-y-2">
          <h2 className="font-cinzel text-sm text-primary flex items-center gap-1"><Zap className="w-4 h-4" /> Turbos & Premium</h2>
          {PACOTES_TURBO.map((p, i) => (
            <Card
              key={`turbo-${i}`}
              className={cn(
                "cursor-pointer transition-all border-2",
                selectedTurbo === i ? "border-primary shadow-gold" : "border-border hover:border-primary/50",
                p.best && "ring-2 ring-primary/30"
              )}
              onClick={() => handleSelect("turbo", i)}
            >
              <CardContent className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <p.icon className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-bold text-sm text-foreground">{p.label}</p>
                    <p className="text-xs text-muted-foreground">{p.desc}</p>
                  </div>
                </div>
                <p className="font-bold text-lg text-primary">R${p.valor.toFixed(2).replace(".", ",")}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pacotes de Likes */}
        <div className="space-y-2">
          <h2 className="font-cinzel text-sm text-primary flex items-center gap-1"><Heart className="w-4 h-4" /> Pacotes de Likes</h2>
          {PACOTES_LIKES.map((p, i) => (
            <Card
              key={`likes-${i}`}
              className={cn(
                "cursor-pointer transition-all border-2",
                selectedLikes === i ? "border-primary shadow-gold" : "border-border hover:border-primary/50",
                p.best && "ring-2 ring-primary/30"
              )}
              onClick={() => handleSelect("likes", i)}
            >
              <CardContent className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Heart className="w-5 h-5 text-primary fill-primary" />
                  <div>
                    <p className="font-bold text-sm text-foreground">{p.label}</p>
                    <p className="text-xs text-muted-foreground">{p.desc}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg text-primary">R${p.valor}</p>
                  <p className="text-xs text-muted-foreground">R${(p.valor / p.likes).toFixed(2)}/like</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* PIX Payment - QR Code */}
        {selected && !pixData && (
          <Card className="border-primary/50 bg-card/80">
            <CardContent className="py-5 space-y-4">
              <h3 className="font-cinzel text-primary text-center">Pagar via PIX Automático</h3>
              <p className="text-xs text-muted-foreground text-center">
                Valor: <strong>R${selected.valor.toFixed(2).replace(".", ",")}</strong> → <strong>{selected.label}</strong>
              </p>
              <p className="text-xs text-center text-green-500 font-medium">
                ⚡ Pagamento detectado automaticamente — sem precisar enviar comprovante!
              </p>
              <Button onClick={handleGerarPix} disabled={generating} className="w-full">
                {generating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando QR Code...</>
                ) : (
                  <><QrCode className="w-4 h-4 mr-2" /> Gerar QR Code PIX</>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* QR Code Display */}
        {pixData && (
          <Card className="border-green-500/50 bg-card/80">
            <CardContent className="py-5 space-y-4">
              <h3 className="font-cinzel text-green-500 text-center">📱 Escaneie o QR Code</h3>

              {pixData.qr_code_base64 ? (
                <div className="flex justify-center">
                  <img
                    src={`data:image/png;base64,${pixData.qr_code_base64}`}
                    alt="QR Code PIX"
                    className="w-48 h-48 rounded-lg border border-border"
                  />
                </div>
              ) : (
                <div className="flex justify-center">
                  <div className="w-48 h-48 rounded-lg border border-border bg-muted flex items-center justify-center">
                    <QrCode className="w-16 h-16 text-muted-foreground" />
                  </div>
                </div>
              )}

              {/* Copy PIX code */}
              <div className="flex items-center gap-2 bg-muted rounded-lg p-3">
                <code className="flex-1 text-xs text-foreground break-all line-clamp-2">
                  {pixData.qr_code}
                </code>
                <Button size="sm" variant="outline" onClick={handleCopyQR}>
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>

              {/* Polling indicator */}
              {polling && (
                <div className="flex items-center justify-center gap-2 text-yellow-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm font-medium">Detectando pagamento...</span>
                </div>
              )}

              <p className="text-xs text-muted-foreground text-center">
                Valor: <strong>R${selected?.valor.toFixed(2).replace(".", ",")}</strong> • {selected?.label}
              </p>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => { setPixData(null); setPolling(false); }}
              >
                Cancelar
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Histórico */}
        {minhasCompras.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-cinzel text-sm text-primary">Minhas Compras</h3>
            {minhasCompras.map((c) => (
              <Card key={c.id} className="border-border">
                <CardContent className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {statusIcon(c.status)}
                    <div>
                      <p className="text-sm font-medium text-foreground">{tipoLabel((c as any).tipo || "likes")}{c.likes_adquiridos > 0 ? ` • ${c.likes_adquiridos} likes` : ""}</p>
                      <p className="text-xs text-muted-foreground">R${Number(c.valor).toFixed(2)}</p>
                    </div>
                  </div>
                  <span className={cn(
                    "text-xs font-medium px-2 py-1 rounded-full",
                    c.status === "aprovado" && "bg-green-500/20 text-green-500",
                    c.status === "rejeitado" && "bg-destructive/20 text-destructive",
                    c.status === "pendente" && "bg-yellow-500/20 text-yellow-500"
                  )}>
                    {c.status === "aprovado" ? "✅ Auto" : c.status}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default ComprarLikes;
