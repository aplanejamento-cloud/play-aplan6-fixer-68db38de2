import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Post, InteractionType } from "@/types/feed";
import { usePostInteractions, useInteract, useRemoveInteraction } from "@/hooks/useInteractions";
import { useFollows, useToggleFollow } from "@/hooks/useFollows";
import { useAuth } from "@/contexts/AuthContext";
import { useDeletePost } from "@/hooks/usePosts";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useRemixCount } from "@/hooks/useRemix";
import { useDuels } from "@/hooks/useDuels";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Heart, Flame, Bomb, UserPlus, UserMinus, Trash2, Crown, User, Music, Gift, Repeat2, Sparkles, Swords, Zap, Share2, Download, Trophy, Gavel, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ImageCarousel from "./ImageCarousel";
import CommentSection from "./CommentSection";
import MimoModal from "@/components/MimoModal";
import VideoPost from "./VideoPost";
import PostModerationBar from "./PostModerationBar";
import YouTubeEmbed, { extractYouTubeId } from "./YouTubeEmbed";
import ChallengeDialog from "./ChallengeDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface PostCardProps {
  post: Post;
}

const PostCard = ({ post }: PostCardProps) => {
  const { user, profile } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { userInteraction } = usePostInteractions(post.id);
  const { following } = useFollows();
  const interact = useInteract();
  const removeInteraction = useRemoveInteraction();
  const toggleFollow = useToggleFollow();
  const deletePost = useDeletePost();
  const { data: remixCount } = useRemixCount(post.id);
  const { challengeUser } = useDuels();
  const navigate = useNavigate();
  const [showMimo, setShowMimo] = useState(false);
  const [showChallenge, setShowChallenge] = useState(false);
  const [showLikers, setShowLikers] = useState(false);

  const isFollowing = following.includes(post.user_id);
  const isOwnPost = user?.id === post.user_id;
  const isTargetJogador = post.author?.user_type === "jogador";

  const allImages: string[] = [];
  if (post.image_url) allImages.push(post.image_url);
  if (post.additional_images) allImages.push(...post.additional_images);

  const handleInteraction = async (type: InteractionType) => {
    if (!user) { toast.error("Faça login para interagir!"); return; }
    try {
      if (userInteraction?.interaction_type === type) {
        await removeInteraction.mutateAsync(userInteraction.id);
        toast.success("Interação removida!");
      } else {
        await interact.mutateAsync({ postId: post.id, interactionType: type });
        const messages: Record<string, string> = { like: "Você curtiu! 💛", love: "LACROU! 🔥", bomb: "BOMBA! 💣" };
        toast.success(messages[type] || "Interação registrada!");
      }
    } catch { toast.error("Erro ao interagir"); }
  };

  const handleToggleFollow = async () => {
    if (!user) { toast.error("Faça login para seguir!"); return; }
    try {
      await toggleFollow.mutateAsync({ targetUserId: post.user_id, isFollowing });
      toast.success(isFollowing ? "Deixou de seguir" : "Seguindo!");
    } catch { toast.error("Erro ao seguir usuário"); }
  };

  const handleDelete = async () => {
    const msg = isAdmin && !isOwnPost
      ? "Deletar post como admin? ✅ Likes PRESERVADOS"
      : "Tem certeza que deseja excluir este post?";
    if (!confirm(msg)) return;
    try {
      await deletePost.mutateAsync(post.id);
      toast.success("Post removido!");
    } catch { toast.error("Erro ao excluir post"); }
  };

  const handleChallengeConfirm = (stakeAmount: number, duelType: "normal" | "fatalite") => {
    challengeUser(post.user_id, stakeAmount, duelType);
  };

  const InteractionButton = ({ type, icon: Icon, label, activeClass, value }: {
    type: InteractionType; icon: typeof Heart; label: string; activeClass: string; value: string;
  }) => {
    const isActive = userInteraction?.interaction_type === type;
    return (
      <button
        onClick={() => handleInteraction(type)}
        disabled={interact.isPending || removeInteraction.isPending}
        className={cn(
          "flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
          isActive ? activeClass : "bg-muted/50 text-muted-foreground hover:bg-muted"
        )}
      >
        <Icon className={cn("w-4 h-4", isActive && "fill-current")} />
        <span className="hidden sm:inline">{label}</span>
        <span className="text-[10px] opacity-70">{value}</span>
      </button>
    );
  };

  const isDesafioPost = !!post.coroinha || !!post.raio;

  const handleShare = async () => {
    const url = `${window.location.origin}/feed`;
    const text = `${post.author?.name || "Alguém"} publicou no PlayLike! 🎉`;
    if (navigator.share) {
      try { await navigator.share({ title: "PlayLike", text, url }); } catch {}
    } else {
      await navigator.clipboard.writeText(`${text} ${url}`);
      toast.success("Link copiado! 📋");
    }
  };

  const handleDownloadMedia = async () => {
    const mediaUrl = post.image_url || post.video_url || post.music_url;
    if (!mediaUrl) return;
    try {
      const response = await fetch(mediaUrl, { mode: "cors" });
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const ext = mediaUrl.split('.').pop()?.split('?')[0] || "jpg";
      a.download = `playlike-${post.id.slice(0, 8)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      toast.success("Download iniciado! 📥");
    } catch {
      window.open(mediaUrl, "_blank");
    }
  };

  const hasMedia = !!(post.image_url || post.video_url || post.music_url);

  return (
    <article className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Desafio approved banner */}
      {isDesafioPost && (
        <div className="bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 border-b border-primary/30 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {post.coroinha && <span className="text-lg">👑</span>}
            {post.raio && <span className="text-lg">⚡</span>}
            <span className="text-xs font-bold text-primary">Desafio Aprovado!</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleShare} className="h-7 text-xs border-primary/30 text-primary hover:bg-primary/10">
            <Share2 className="w-3.5 h-3.5 mr-1" />Compartilhar
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="p-3">
        <header className="flex items-start justify-between">
          <button
            className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
            onClick={() => navigate(`/profile/${post.user_id}`)}
          >
            <div className={cn("relative w-10 h-10 rounded-full flex items-center justify-center overflow-hidden", post.author?.eliminated_at ? "bg-muted grayscale" : "bg-primary/20")}>
              {post.author?.avatar_url ? (
                <img src={post.author.avatar_url} alt={post.author.name} className={cn("w-full h-full object-cover", post.author?.eliminated_at && "grayscale opacity-50")} />
              ) : (
                <span className="text-primary font-bold text-sm">{post.author?.name?.charAt(0).toUpperCase()}</span>
              )}
              {isDesafioPost && (
                <div className="absolute -bottom-0.5 -right-0.5 flex gap-0">
                  {post.coroinha && <span className="text-[10px]">👑</span>}
                  {post.raio && <span className="text-[10px]">⚡</span>}
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={cn("font-semibold", post.author?.eliminated_at ? "text-muted-foreground line-through" : "text-foreground")}>{post.author?.name || "Anônimo"}</span>
                {post.author?.eliminated_at ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/20 text-destructive font-bold">💀 ELIMINADO</span>
                ) : post.author?.user_type === "jogador" ? <Crown className="w-3.5 h-3.5 text-primary" /> : <User className="w-3.5 h-3.5 text-accent" />}
                {isAdmin && (post.author as any)?.is_bot && <span className="text-[9px] px-1 py-0.5 rounded bg-accent/20 text-accent">🤖</span>}
              </div>
              <time className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}
              </time>
            </div>
          </button>
          <div className="flex items-center gap-2">
            {!isOwnPost && user && (
              <Button variant="ghost" size="sm" onClick={handleToggleFollow} disabled={toggleFollow.isPending} className={cn("h-8 px-2", isFollowing ? "text-primary" : "text-muted-foreground")}>
                {isFollowing ? <UserMinus className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              </Button>
            )}
            {isAdmin && (
              <Button variant="ghost" size="sm" onClick={handleDelete} disabled={deletePost.isPending} className="h-8 px-2 text-destructive hover:text-destructive">
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </header>

        {/* Tema badge */}
        {post.multiplicador && post.multiplicador > 1 && (
          <div className="mt-2 flex items-center gap-1.5 bg-primary/10 border border-primary/30 rounded-full px-3 py-1 w-fit">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-bold text-primary">✅ Postou com tema • {post.multiplicador}x likes</span>
          </div>
        )}

        {/* Challenge proof badge */}
        {post.categoria === "desafio-prova" && (
          <div className="mt-2 flex items-center gap-1.5 bg-primary/10 border border-primary/30 rounded-full px-3 py-1 w-fit">
            <Trophy className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-bold text-primary">🏆 Desafio completado!</span>
          </div>
        )}

      {post.content && (
          <div className="mt-2">
            <p className="text-foreground whitespace-pre-wrap break-words">
              {post.content.split(/(\s+)/).map((word, i) => {
                if (/https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(word)) {
                  return <span key={i} className="text-muted-foreground cursor-not-allowed">[link YouTube bloqueado]</span>;
                }
                if (/https?:\/\/\S+/i.test(word)) {
                  return <span key={i} className="text-muted-foreground">{word}</span>;
                }
                return word;
              })}
            </p>
            {extractYouTubeId(post.content) && (
              <div className="mt-2">
                <YouTubeEmbed url={post.content} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* MEDIA */}
      {allImages.length > 0 && (
        <div className="w-full">
          <ImageCarousel images={allImages} />
        </div>
      )}

      {post.video_url && (
        <div className="w-full">
          <VideoPost src={post.video_url} />
        </div>
      )}

      {post.music_url && (
        <div className="flex items-center gap-3 p-3 mx-3 bg-muted/30 rounded-lg border border-border">
          <Music className="w-6 h-6 text-primary flex-shrink-0" />
          <audio src={post.music_url} controls className="w-full" preload="metadata" />
        </div>
      )}

      {/* Footer */}
      <div className="p-3 space-y-3">
        <button
          onClick={() => setShowLikers(true)}
          className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity cursor-pointer"
        >
          <Heart className={cn("w-4 h-4", post.likes_count >= 0 ? "text-primary fill-primary" : "text-destructive")} />
          <span className={cn("font-bold", post.likes_count >= 10 ? "text-primary glow-gold" : post.likes_count < 0 ? "text-destructive" : "text-foreground")}>
            {post.likes_count.toLocaleString("pt-BR")}
          </span>
          <span className="text-muted-foreground underline">likes</span>
        </button>

        <footer className="flex flex-wrap gap-2 pt-2 border-t border-border">
          <InteractionButton type="like" icon={Heart} label="Curtir" activeClass="bg-primary/20 text-primary" value="+1" />
          <InteractionButton type="love" icon={Flame} label="Lacrou" activeClass="bg-orange-500/20 text-orange-500" value="+10" />
          <InteractionButton type="bomb" icon={Bomb} label="Bomba" activeClass="bg-destructive/20 text-destructive" value="-10" />
          
          {hasMedia && (
            <button
              onClick={handleDownloadMedia}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-muted/50 text-muted-foreground hover:bg-muted transition-all"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Baixar</span>
            </button>
          )}
          
          {/* Challenge button - only jogadores can challenge other jogadores (juiz blocked) */}
          {user && !isOwnPost && isTargetJogador && profile?.user_type === "jogador" && !post.author?.eliminated_at && (
            <button
              onClick={() => setShowChallenge(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all"
            >
              <Swords className="w-4 h-4" />
              <span className="hidden sm:inline">Duelo</span>
            </button>
          )}
          
          {user && !isOwnPost && (
            <button
              onClick={() => {
                const mediaParam = post.image_url ? `&image=${encodeURIComponent(post.image_url)}` : post.video_url ? `&video=${encodeURIComponent(post.video_url)}` : "";
                const captionParam = post.content ? `&caption=${encodeURIComponent(post.content)}` : "";
                navigate(`/editor?remix=${post.id}${mediaParam}${captionParam}`);
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-secondary/50 text-secondary-foreground hover:bg-secondary/70 transition-all"
            >
              <Repeat2 className="w-4 h-4" />
              <span className="hidden sm:inline">Remix</span>
              {(remixCount || 0) > 0 && <span className="text-[10px] opacity-70">{remixCount}</span>}
            </button>
          )}
          {profile?.user_type === "juiz" && !isOwnPost && user && post.author?.user_type === "jogador" && (
            <button
              onClick={() => setShowMimo(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-accent/20 text-accent hover:bg-accent/30 transition-all ml-auto"
            >
              <Gift className="w-4 h-4" />
              <span className="hidden sm:inline">Mimo</span>
            </button>
          )}
          
          {/* Desafios link */}
          {user && (
            <button
              onClick={() => navigate("/desafios-juiz")}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-muted/50 text-muted-foreground hover:bg-muted transition-all"
            >
              <Gavel className="w-4 h-4" />
              <span className="hidden sm:inline">Desafios</span>
            </button>
          )}
          
          {/* Fiz isso! button for desafio posts - only non-juiz users */}
          {isDesafioPost && user && !isOwnPost && profile?.user_type !== "juiz" && (
            <button
              onClick={() => navigate(`/desafios-juiz`)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-primary/20 text-primary hover:bg-primary/30 transition-all"
            >
              <Trophy className="w-4 h-4" />
              <span>Fiz isso!</span>
            </button>
          )}
        </footer>

        <PostModerationBar
          postId={post.id}
          dislikes={(post as any).dislikes_tema || 0}
          denuncias={(post as any).denuncias_improprio || 0}
          temaTitle={undefined}
          temaFator={undefined}
        />

        <CommentSection postId={post.id} />
      </div>

      {showMimo && post.author && (
        <MimoModal
          open={showMimo}
          onOpenChange={setShowMimo}
          targetUserId={post.user_id}
          targetName={post.author.name}
        />
      )}

      {showChallenge && post.author && (
        <ChallengeDialog
          open={showChallenge}
          onOpenChange={setShowChallenge}
          targetName={post.author.name}
          onConfirm={handleChallengeConfirm}
        />
      )}

      {/* Likers Dialog */}
      <LikersDialog open={showLikers} onOpenChange={setShowLikers} postId={post.id} />
    </article>
  );
};

/* Likers Dialog - shows who liked the post */
const LikersDialog = ({ open, onOpenChange, postId }: { open: boolean; onOpenChange: (o: boolean) => void; postId: string }) => {
  const navigate = useNavigate();
  const { data: likers = [], isLoading } = useQuery({
    queryKey: ["post-likers", postId],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("post_interactions")
        .select("interaction_type, user_id")
        .eq("post_id", postId)
        .order("created_at", { ascending: false });
      if (!data || data.length === 0) return [];
      const userIds = [...new Set(data.map(d => d.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name, avatar_url")
        .in("user_id", userIds);
      return data.map(d => ({
        ...d,
        profile: profiles?.find(p => p.user_id === d.user_id),
      }));
    },
  });

  const emojiMap: Record<string, string> = { like: "❤️", love: "🔥", bomb: "💣" };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[70vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-primary font-cinzel">Quem interagiu</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
        ) : likers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma interação ainda.</p>
        ) : (
          <div className="space-y-2">
            {likers.map((l, i) => (
              <button
                key={i}
                onClick={() => { onOpenChange(false); navigate(`/profile/${l.user_id}`); }}
                className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
              >
                <Avatar className="w-8 h-8">
                  <AvatarImage src={l.profile?.avatar_url || ""} />
                  <AvatarFallback>{l.profile?.name?.charAt(0) || "?"}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-foreground flex-1">{l.profile?.name || "Anônimo"}</span>
                <span className="text-lg">{emojiMap[l.interaction_type] || "❤️"}</span>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
};

export default PostCard;
