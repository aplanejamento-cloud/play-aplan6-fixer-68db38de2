import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useReferrals } from "@/hooks/useReferrals";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Star, Home, Clock, CheckCircle2, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const NETWORKS = [
  { id: "whatsapp", name: "WhatsApp", icon: "💬", color: "bg-green-600" },
  { id: "telegram", name: "Telegram", icon: "✈️", color: "bg-blue-500" },
  { id: "instagram", name: "Instagram", icon: "📸", color: "bg-pink-500" },
  { id: "facebook", name: "Facebook", icon: "📘", color: "bg-blue-600" },
  { id: "tiktok", name: "TikTok", icon: "🎵", color: "bg-slate-800" },
  { id: "kwai", name: "Kwai", icon: "🎬", color: "bg-orange-500" },
  { id: "twitter", name: "Twitter/X", icon: "🐦", color: "bg-sky-500" },
  { id: "youtube", name: "YouTube", icon: "▶️", color: "bg-red-600" },
  { id: "linkedin", name: "LinkedIn", icon: "💼", color: "bg-blue-700" },
  { id: "discord", name: "Discord", icon: "🎮", color: "bg-indigo-600" },
  { id: "snapchat", name: "Snapchat", icon: "👻", color: "bg-yellow-400" },
  { id: "pinterest", name: "Pinterest", icon: "📌", color: "bg-red-500" },
  { id: "reddit", name: "Reddit", icon: "🤖", color: "bg-orange-600" },
  { id: "signal", name: "Signal", icon: "🔒", color: "bg-blue-400" },
  { id: "threads", name: "Threads", icon: "🧵", color: "bg-slate-700" },
  { id: "bluesky", name: "Bluesky", icon: "🦋", color: "bg-sky-400" },
  { id: "messenger", name: "Messenger", icon: "💭", color: "bg-purple-500" },
  { id: "email", name: "Email", icon: "📧", color: "bg-gray-600" },
  { id: "sms", name: "SMS", icon: "📱", color: "bg-green-500" },
  { id: "copiar-link", name: "Copiar Link", icon: "🔗", color: "bg-gray-500" },
  { id: "twitch", name: "Twitch", icon: "🟣", color: "bg-purple-600" },
  { id: "github", name: "GitHub", icon: "🐙", color: "bg-gray-700" },
  { id: "qrcode", name: "QR Code", icon: "📲", color: "bg-slate-600" },
  { id: "whatsapp-status", name: "WA Status", icon: "⭕", color: "bg-green-700" },
];

const Convites = () => {
  const { user, profile } = useAuth();
  const { shares, createShare, totalLikesEarned, networksUsed, verifiedShares, pendingShares, totalClicks } = useReferrals();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loadingNetwork, setLoadingNetwork] = useState<string | null>(null);

  // Check if user has at least 1 post
  const { data: postsCount = 0 } = useQuery({
    queryKey: ["user_posts_count", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("deletado", false);
      return count ?? 0;
    },
  });

  const hasPosted = postsCount >= 1;

  const [instagramModal, setInstagramModal] = useState(false);
  const [instagramText, setInstagramText] = useState("");

  const buildShareUrl = (trackingUrl: string, networkId: string) => {
    const text = `Você não vai acreditar, lançaram uma Rede Social dos Famosos chamada Playlike, onde as pessoas publicam fotos e vídeos em troca de likes e estes likes podem ser trocados por prêmios cadastrados na página.\n\nE ainda vão eleger o melhor influenciador do Brasil.\n\nEu já me cadastrei e estou esperando a Rede Iniciar.\n\nSó pode se cadastrar agora quem recebe convite, porque o jogo ainda não iniciou e a rede está fechada para convidados.\n\nTe mandei o link abaixo para você conseguir se cadastrar também e aguardar o jogo começar\n\n🔥 Convide Playlike app! Cadastre-se grátis: ${trackingUrl}`;
    const encodedText = encodeURIComponent(text);
    const encodedUrl = encodeURIComponent(trackingUrl);
    const shortText = encodeURIComponent(`🔥 Convide Playlike app! Cadastre-se grátis: ${trackingUrl}`);
    const fbText = encodeURIComponent(`Você não vai acreditar, lançaram uma Rede Social dos Famosos chamada Playlike! Eu já me cadastrei. Cadastre-se grátis: ${trackingUrl}`);

    const urls: Record<string, string> = {
      whatsapp: `https://wa.me/?text=${encodedText}`,
      "whatsapp-status": `https://wa.me/?text=${encodedText}`,
      telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${fbText}`,
      instagram: "__instagram__",
      twitter: `https://twitter.com/intent/tweet?text=${shortText}`,
      threads: `https://www.threads.net/intent/post?text=${shortText}`,
      bluesky: `https://bsky.app/intent/compose?text=${shortText}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      reddit: `https://reddit.com/submit?url=${encodedUrl}&title=${encodeURIComponent("Convide Playlike app!")}`,
      pinterest: `https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${shortText}`,
      discord: `https://discord.com/`,
      messenger: `https://www.facebook.com/dialog/send?link=${encodedUrl}&app_id=&redirect_uri=${encodedUrl}`,
      email: `mailto:?subject=${encodeURIComponent("Convite PlayLike!")}&body=${encodedText}`,
      sms: `sms:?body=${encodedText}`,
      tiktok: `https://www.tiktok.com/`,
      kwai: `https://www.kwai.com/`,
      youtube: `https://www.youtube.com/`,
      snapchat: `https://www.snapchat.com/`,
      twitch: `https://www.twitch.tv/`,
      github: `https://github.com/`,
      signal: `https://signal.me/`,
    };
    return urls[networkId] || null;
  };

  const handleNetworkClick = async (networkId: string) => {
    if (!hasPosted) {
      toast({ title: "📝 Publique pelo menos 1 post antes de convidar!", description: "Vá ao Feed e publique algo primeiro." });
      return;
    }
    setLoadingNetwork(networkId);

    try {
      // Create a tracked share with unique code
      const result = await createShare(networkId);
      if (!result) {
        toast({ title: "Erro ao gerar convite", variant: "destructive" });
        setLoadingNetwork(null);
        return;
      }

      const { trackingUrl } = result;

      if (networkId === "copiar-link" || networkId === "qrcode") {
        await navigator.clipboard.writeText(trackingUrl);
        toast({ title: "Link rastreado copiado! 📋", description: "Likes serão creditados quando alguém clicar." });
      } else if (networkId === "instagram") {
        // Instagram doesn't support direct sharing - show copy modal
        const igText = `🔥 Convide Playlike app! Cadastre-se grátis:\n${trackingUrl}`;
        setInstagramText(igText);
        setInstagramModal(true);
        try { await navigator.clipboard.writeText(igText); } catch {}
        toast({ title: "📋 Texto copiado!", description: "Cole no Instagram e compartilhe!" });
      } else {
        const shareUrl = buildShareUrl(trackingUrl, networkId);
        if (shareUrl) {
          window.open(shareUrl, "_blank");
        }
        toast({
          title: `📤 Convite enviado via ${NETWORKS.find((n) => n.id === networkId)?.name}!`,
          description: "⏳ Likes serão creditados quando alguém clicar no seu link.",
        });
      }
    } catch (e) {
      toast({ title: "Erro ao compartilhar", variant: "destructive" });
    }

    setLoadingNetwork(null);
  };

  const getNetworkStatus = (networkId: string) => {
    const networkShares = shares.filter((s) => s.network === networkId);
    if (networkShares.length === 0) return "new";
    if (networkShares.some((s) => s.likes_awarded)) return "verified";
    return "pending";
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container mx-auto px-4 py-6 max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="font-cinzel text-2xl md:text-3xl text-primary glow-gold flex items-center justify-center gap-2">
            <Star className="w-7 h-7" />
            Ganhe até 3.100 Likes GRÁTIS!
          </h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Convide amigos de cada rede → <span className="text-primary font-bold">100 likes/rede</span> (1ª vez)
          </p>
          <p className="text-xs text-muted-foreground">
            ⚡ Likes são creditados <span className="text-primary font-semibold">quando alguém clicar</span> no seu link
          </p>
          {!hasPosted && (
            <p className="text-xs text-destructive font-bold">📝 Publique pelo menos 1 post no Feed antes de convidar!</p>
          )}
        </div>

        {/* Stats */}
        <Card className="bg-card/80 border-border">
          <CardContent className="py-4 flex items-center justify-around text-center">
            <div>
              <p className="text-2xl font-bold text-primary">{verifiedShares}</p>
              <p className="text-xs text-muted-foreground">Verificados</p>
            </div>
            <div className="w-px h-10 bg-border" />
            <div>
              <p className="text-2xl font-bold text-muted-foreground">{pendingShares}</p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </div>
            <div className="w-px h-10 bg-border" />
            <div>
              <p className="text-2xl font-bold text-primary">{totalClicks}</p>
              <p className="text-xs text-muted-foreground">Cliques</p>
            </div>
            <div className="w-px h-10 bg-border" />
            <div>
              <p className="text-2xl font-bold text-primary">{totalLikesEarned.toLocaleString("pt-BR")}</p>
              <p className="text-xs text-muted-foreground">Likes ganhos</p>
            </div>
          </CardContent>
        </Card>

        {/* Networks Grid */}
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
          {NETWORKS.map((network) => {
            const status = getNetworkStatus(network.id);
            return (
              <button
                key={network.id}
                onClick={() => handleNetworkClick(network.id)}
                disabled={loadingNetwork === network.id}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all active:scale-95 relative ${
                  status === "verified"
                    ? "border-primary/50 bg-primary/10"
                    : status === "pending"
                    ? "border-yellow-500/50 bg-yellow-500/10"
                    : "border-border bg-card hover:border-primary/30 hover:bg-card/80"
                }`}
              >
                <span className="text-2xl md:text-3xl">{network.icon}</span>
                <span className="text-[10px] md:text-xs text-foreground leading-tight text-center">{network.name}</span>
                {status === "verified" && (
                  <CheckCircle2 className="w-3 h-3 text-primary absolute top-1 right-1" />
                )}
                {status === "pending" && (
                  <Clock className="w-3 h-3 text-yellow-500 absolute top-1 right-1" />
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-primary" /> Verificado</span>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-yellow-500" /> Aguardando clique</span>
          <span className="flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Novo</span>
        </div>

        {networksUsed >= 10 && (
          <div className="text-center py-3">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 border border-primary/40 text-primary font-cinzel text-sm shadow-gold">
              🏆 Top Convidador — {networksUsed} redes!
            </span>
          </div>
        )}

        <div className="text-center pt-4">
          <Button onClick={() => navigate("/feed")} className="bg-primary text-primary-foreground hover:bg-primary/90 font-cinzel text-lg px-8 shadow-gold">
            <Home className="w-5 h-5 mr-2" />
            Ir para Playlike
          </Button>
        </div>

        {/* Instagram Copy Modal */}
        {instagramModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setInstagramModal(false)}>
            <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
              <h3 className="font-cinzel text-lg text-primary text-center">📸 Compartilhar no Instagram</h3>
              <p className="text-xs text-muted-foreground text-center">O texto já foi copiado! Cole na legenda ou stories do Instagram.</p>
              <textarea
                readOnly
                value={instagramText}
                className="w-full h-24 bg-muted border border-border rounded-lg p-3 text-xs text-foreground resize-none"
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(instagramText);
                    toast({ title: "📋 Copiado!" });
                  }}
                  variant="outline"
                  className="flex-1 border-border text-foreground"
                >
                  Copiar
                </Button>
                <Button
                  onClick={() => {
                    window.open("https://www.instagram.com/", "_blank");
                    setInstagramModal(false);
                  }}
                  className="flex-1 bg-primary text-primary-foreground"
                >
                  Abrir Instagram
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Convites;
