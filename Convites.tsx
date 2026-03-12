import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useReferrals } from "@/hooks/useReferrals";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Star, Copy, QrCode, Mail, Home } from "lucide-react";
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
  { id: "line", name: "Line", icon: "🟢", color: "bg-green-500" },
  { id: "viber", name: "Viber", icon: "🟣", color: "bg-purple-500" },
  { id: "wechat", name: "WeChat", icon: "💹", color: "bg-green-600" },
  { id: "mastodon", name: "Mastodon", icon: "🐘", color: "bg-indigo-500" },
  { id: "tumblr", name: "Tumblr", icon: "Tt", color: "bg-blue-900" },
  { id: "medium", name: "Medium", icon: "M", color: "bg-black" },
  { id: "slack", name: "Slack", icon: "💬", color: "bg-purple-800" },
  { id: "clubhouse", name: "Clubhouse", icon: "👋", color: "bg-amber-200" },
  { id: "bereal", name: "BeReal", icon: "📸", color: "bg-black" },
];

const Convites = () => {
  const { user, profile } = useAuth();
  const { referrals, claimNetwork, totalLikesEarned, networksUsed } = useReferrals();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loadingNetwork, setLoadingNetwork] = useState<string | null>(null);
  const [showCopyDialog, setShowCopyDialog] = useState<string | null>(null);

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

  const PROD_URL = "https://playlike.lovable.app";
  const referralLink = `${PROD_URL}/?ref=${user?.id?.slice(0, 8)}`;

  const getShareText = () =>
    `Você não vai acreditar no que está acontecendo no PlayLike! 😱\n\nLançaram uma Rede Social dos Famosos chamada Playlike, onde as pessoas publicam fotos e vídeos em troca de likes e estes likes podem ser trocados por prêmios cadastrados na página.\n\nE ainda vão eleger o melhor influenciador do Brasil.\n\nEu já me cadastrei e estou esperando a Rede Iniciar.\n\nSó pode se cadastrar agora quem recebe convite, porque o jogo ainda não iniciou e a rede está fechada para convidados.\n\nTe mandei o link abaixo para você conseguir se cadastrar também e aguardar o jogo começar\n\n🔥 Convide Playlike app! Cadastre-se grátis: ${referralLink}`;

  const getShortShareText = () => `Playlike - Ganhe likes! ${referralLink}`;

  const openShareUrl = (network: string) => {
    const text = encodeURIComponent(getShareText());
    const shortText = encodeURIComponent(getShortShareText());
    const url = encodeURIComponent(referralLink);
    const urls: Record<string, string> = {
      whatsapp: `https://wa.me/?text=${text}`,
      "whatsapp-status": `https://wa.me/?text=${text}`,
      telegram: `https://t.me/share/url?url=${url}&text=${text}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${text}`,
      instagram: `https://www.instagram.com/`,
      twitter: `https://twitter.com/intent/tweet?text=${shortText}`,
      threads: `https://www.threads.net/intent/post?text=${shortText}`,
      bluesky: `https://bsky.app/intent/compose?text=${shortText}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
      reddit: `https://reddit.com/submit?url=${url}&title=${encodeURIComponent("Convide Playlike app!")}`,
      pinterest: `https://pinterest.com/pin/create/button/?url=${url}&description=${shortText}`,
      discord: `https://discord.com/`,
      messenger: `https://www.facebook.com/dialog/send?link=${url}&app_id=&redirect_uri=${url}`,
      email: `mailto:?subject=${encodeURIComponent("Convite PlayLike!")}&body=${text}`,
      sms: `sms:?body=${text}`,
      tiktok: `https://www.tiktok.com/`,
      kwai: `https://www.kwai.com/`,
      youtube: `https://www.youtube.com/`,
      snapchat: `https://www.snapchat.com/`,
      twitch: `https://www.twitch.tv/`,
      github: `https://github.com/`,
      signal: `https://signal.me/`,
    };
    if (urls[network]) {
      window.open(urls[network], "_blank");
    }
  };

  const handleNetworkClick = async (networkId: string) => {
    console.log(`[Convites] Clicou na rede: ${networkId}`);
    if (!hasPosted) {
      toast({ title: "📝 Publique pelo menos 1 post antes de convidar!", description: "Vá ao Feed e publique algo primeiro." });
      return;
    }
    setLoadingNetwork(networkId);

    if (networkId === "copiar-link" || networkId === "qrcode") {
      await navigator.clipboard.writeText(referralLink);
      toast({ title: "Link copiado!", description: referralLink });
    }

    const { success, likes } = await claimNetwork(networkId);
    if (success) {
      toast({
        title: `+${likes.toLocaleString("pt-BR")} likes! 🎉`,
        description:
          likes === 100
            ? `Primeira vez via ${NETWORKS.find((n) => n.id === networkId)?.name}! Parabéns!`
            : `+10 likes por compartilhar via ${NETWORKS.find((n) => n.id === networkId)?.name}`,
      });
    }

    // For networks that don't support direct sharing, show copy dialog
    const needsCopy = ["instagram", "tiktok", "kwai", "youtube", "snapchat", "twitch", "github", "signal", "bluesky", "threads"];
    if (needsCopy.includes(networkId)) {
      console.log(`[Convites] Abrindo modal de cópia para: ${networkId}`);
      setShowCopyDialog(networkId);
    } else {
      openShareUrl(networkId);
    }

    setLoadingNetwork(null);
  };

  const isUsed = (networkId: string) => referrals.some((r) => r.network === networkId);

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
            Convide amigos de cada rede → <span className="text-primary font-bold">Ganhe até 3.100 Likes GRÁTIS! → 100(1ª)/10(2ª+)</span>
          </p>
          {!hasPosted && (
            <p className="text-xs text-destructive font-bold">📝 Publique pelo menos 1 post no Feed antes de convidar!</p>
          )}
        </div>

        {/* Stats */}
        <Card className="bg-card/80 border-border">
          <CardContent className="py-4 flex items-center justify-around text-center">
            <div>
              <p className="text-2xl font-bold text-primary">{networksUsed}</p>
              <p className="text-xs text-muted-foreground">Redes usadas</p>
            </div>
            <div className="w-px h-10 bg-border" />
            <div>
              <p className="text-2xl font-bold text-primary">{totalLikesEarned.toLocaleString("pt-BR")}</p>
              <p className="text-xs text-muted-foreground">Likes ganhos</p>
            </div>
            <div className="w-px h-10 bg-border" />
            <div>
              <p className="text-2xl font-bold text-foreground">{(3100 - totalLikesEarned).toLocaleString("pt-BR")}</p>
              <p className="text-xs text-muted-foreground">Likes restantes</p>
            </div>
          </CardContent>
        </Card>

        {/* Networks Grid */}
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
          {NETWORKS.map((network) => {
            const used = isUsed(network.id);
            return (
              <button key={network.id} onClick={() => handleNetworkClick(network.id)} disabled={loadingNetwork === network.id}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all active:scale-95 ${
                  used ? "border-primary/50 bg-primary/10" : "border-border bg-card hover:border-primary/30 hover:bg-card/80"
                }`}>
                <span className="text-2xl md:text-3xl">{network.icon}</span>
                <span className="text-[10px] md:text-xs text-foreground leading-tight text-center">{network.name}</span>
                {used && <span className="text-[9px] text-primary font-bold">✓</span>}
              </button>
            );
          })}
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
      </main>
      {/* Copy Dialog */}
      {showCopyDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-sm bg-card border-primary/30 shadow-gold overflow-hidden">
            <CardContent className="p-6 space-y-4 text-center">
              <div className="text-4xl mb-2">
                {NETWORKS.find(n => n.id === showCopyDialog)?.icon}
              </div>
              <h3 className="font-cinzel text-lg text-primary">Copie: Playlike + link único</h3>
              <p className="text-sm text-muted-foreground">
                Copie o texto abaixo e cole no seu {NETWORKS.find(n => n.id === showCopyDialog)?.name} para ganhar seus likes!
              </p>
              
              <div className="bg-muted p-3 rounded-lg text-xs text-left font-mono break-all border border-border max-h-32 overflow-y-auto">
                {getShortShareText()}
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button 
                  onClick={async () => {
                    await navigator.clipboard.writeText(getShortShareText());
                    toast({ title: "Copiado!", description: "Texto copiado para a área de transferência." });
                    console.log(`[Convites] Texto copiado: ${getShortShareText()}`);
                  }}
                  className="bg-primary text-primary-foreground"
                >
                  <Copy className="w-4 h-4 mr-2" /> Copiar Texto + Link
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    const network = showCopyDialog;
                    console.log(`[Convites] Abrindo rede: ${network}`);
                    openShareUrl(network);
                    setShowCopyDialog(null);
                  }}
                >
                  Abrir {NETWORKS.find(n => n.id === showCopyDialog)?.name}
                </Button>
                <Button variant="ghost" onClick={() => setShowCopyDialog(null)}>
                  Fechar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Convites;
