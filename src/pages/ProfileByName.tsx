import { useParams, Navigate, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Heart, Users, Copy, UserPlus, UserMinus, MessageCircle, Mail, ChevronLeft, ChevronRight, Image as ImageIcon, Video } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import AppHeader from "@/components/AppHeader";
import PostCard from "@/components/feed/PostCard";
import { useFollows, useToggleFollow } from "@/hooks/useFollows";

const normalizeUsername = (name: string) =>
  name.toLowerCase().replace(/\s+/g, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const ProfileByName = () => {
  const params = useParams<{ username: string }>();
  const username = params.username || window.location.pathname.replace(/^\/@/, '');
  const { user } = useAuth();
  const navigate = useNavigate();
  const { following } = useFollows();
  const toggleFollow = useToggleFollow();
  const [galleryIndex, setGalleryIndex] = useState(0);

  const { data: profileData, isLoading } = useQuery({
    queryKey: ["profile-by-name", username],
    queryFn: async () => {
      if (!username) return null;
      const target = normalizeUsername(username);
      const nameWithSpaces = username.replace(/-/g, " ");
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .ilike("name", `%${nameWithSpaces}%`);
      if (data && data.length > 0) {
        const match = data.find((p) => normalizeUsername(p.name) === target);
        if (match) return match;
      }
      const { data: allData } = await supabase
        .from("profiles")
        .select("*");
      if (!allData) return null;
      return allData.find((p) => normalizeUsername(p.name) === target) || null;
    },
    enabled: !!username,
  });

  const { data: followersCount = 0 } = useQuery({
    queryKey: ["followers-count-public", profileData?.user_id],
    queryFn: async () => {
      if (!profileData?.user_id) return 0;
      const { count } = await supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profileData.user_id);
      return count || 0;
    },
    enabled: !!profileData?.user_id,
  });

  const { data: userPosts = [] } = useQuery({
    queryKey: ["user-posts-public", profileData?.user_id],
    queryFn: async () => {
      if (!profileData?.user_id) return [];
      const { data: posts } = await supabase
        .from("posts")
        .select("*, author:profiles!posts_user_id_fkey(id, name, avatar_url, user_type)")
        .eq("user_id", profileData.user_id)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(20);
      return (posts || []).map((p: any) => ({ ...p, author: Array.isArray(p.author) ? p.author[0] : p.author }));
    },
    enabled: !!profileData?.user_id,
  });

  // Fetch user media (photos + videos)
  const { data: userMedia = [] } = useQuery({
    queryKey: ["user-media-public", profileData?.user_id],
    queryFn: async () => {
      if (!profileData?.user_id) return [];
      const { data } = await supabase
        .from("user_media")
        .select("*")
        .eq("user_id", profileData.user_id)
        .order("position", { ascending: true });
      return data || [];
    },
    enabled: !!profileData?.user_id,
  });

  const photos = userMedia.filter((m) => m.media_type === "photo");
  const videos = userMedia.filter((m) => m.media_type === "video");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="min-h-screen bg-background">
        {user ? <AppHeader /> : (
          <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
            <div className="container mx-auto px-4 py-3 flex items-center justify-between">
              <button onClick={() => navigate("/")} className="font-cinzel text-xl text-primary glow-gold-subtle">PLAYLIKE</button>
              <Button onClick={() => navigate("/")} variant="outline" size="sm">Entrar</Button>
            </div>
          </header>
        )}
        <main className="container mx-auto px-4 py-20 text-center">
          <h1 className="font-cinzel text-4xl text-primary mb-4">404</h1>
          <p className="text-muted-foreground text-lg">Perfil @{username} não encontrado.</p>
          <Button onClick={() => navigate("/")} className="mt-6 bg-primary text-primary-foreground">Ir para Home</Button>
        </main>
      </div>
    );
  }

  // If user is logged in and viewing own profile, redirect to /profile
  if (user && user.id === profileData.user_id) {
    return <Navigate to="/profile" replace />;
  }

  const usernameNormalized = normalizeUsername(profileData.name);
  const profileUrl = `${window.location.origin}/@${usernameNormalized}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(profileUrl);
    toast.success("Link copiado!");
  };

  return (
    <div className="min-h-screen bg-background">
      {user ? <AppHeader /> : (
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <button onClick={() => navigate("/")} className="font-cinzel text-xl text-primary glow-gold-subtle">PLAYLIKE</button>
            <Button onClick={() => navigate("/")} variant="outline" size="sm">Entrar</Button>
          </div>
        </header>
      )}

      <main className="container mx-auto px-4 py-6 max-w-2xl space-y-6">
        {/* Profile Header */}
        <div className="flex flex-col items-center gap-4">
          <Avatar className="w-28 h-28 md:w-32 md:h-32 border-4 border-primary shadow-gold">
            <AvatarImage src={profileData.avatar_url || ""} />
            <AvatarFallback className="bg-secondary text-foreground font-cinzel text-3xl">
              {profileData.name?.charAt(0) || "?"}
            </AvatarFallback>
          </Avatar>

          <div className="text-center">
            <h2 className="font-cinzel text-2xl text-foreground">{profileData.name}</h2>
            <button
              onClick={handleCopyLink}
              className="text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer flex items-center gap-1 mx-auto"
              title="Clique para copiar link"
            >
              @{usernameNormalized}
              <Copy className="w-3 h-3" />
            </button>
            <p className="text-xs text-muted-foreground capitalize mt-0.5">{profileData.user_type}</p>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="flex items-center gap-1 text-primary">
                <Heart className="w-5 h-5 fill-primary" />
                <span className="font-bold text-lg">{profileData.total_likes?.toLocaleString("pt-BR")}</span>
              </div>
              <p className="text-xs text-muted-foreground">Likes</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <div className="flex items-center gap-1 text-accent">
                <Users className="w-5 h-5" />
                <span className="font-bold text-lg">{followersCount}</span>
              </div>
              <p className="text-xs text-muted-foreground">Seguidores</p>
            </div>
          </div>

          {/* Follow button */}
          {user && profileData?.user_id && (
            <Button
              variant={following.includes(profileData.user_id) ? "outline" : "default"}
              onClick={() => toggleFollow.mutateAsync({ targetUserId: profileData.user_id, isFollowing: following.includes(profileData.user_id) })}
              disabled={toggleFollow.isPending}
              className="font-cinzel"
            >
              {following.includes(profileData.user_id) ? <><UserMinus className="w-4 h-4 mr-2" /> Seguindo</> : <><UserPlus className="w-4 h-4 mr-2" /> Seguir este perfil</>}
            </Button>
          )}

          {/* Bio */}
          {profileData.bio && (
            <p className="text-sm text-foreground/80 text-center max-w-md">{profileData.bio}</p>
          )}
        </div>

        {/* WhatsApp - visible if show_whatsapp is true */}
        {(profileData as any)?.show_whatsapp && profileData.whatsapp && (
          <Card className="bg-card/80 border-border">
            <CardContent className="py-4 flex items-center gap-3">
              <MessageCircle className="w-5 h-5 text-accent" />
              <div>
                <p className="text-xs text-muted-foreground">WhatsApp</p>
                <p className="text-sm text-foreground">{profileData.whatsapp}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Email - visible if show_email_public is true */}
        {(profileData as any)?.show_email_public && (profileData as any)?.email && (
          <Card className="bg-card/80 border-border">
            <CardContent className="py-4 flex items-center gap-3">
              <Mail className="w-5 h-5 text-accent" />
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm text-foreground">{(profileData as any).email}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Photo Gallery */}
        {photos.length > 0 && (
          <Card className="bg-card/80 border-border">
            <CardContent className="py-4 space-y-3">
              <h3 className="font-cinzel text-sm text-primary flex items-center gap-2">
                <ImageIcon className="w-4 h-4" /> Fotos ({photos.length})
              </h3>
              <div className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                <img src={photos[galleryIndex]?.media_url} alt="" className="w-full h-full object-cover" />
                {photos.length > 1 && (
                  <>
                    <button onClick={() => setGalleryIndex((i) => (i - 1 + photos.length) % photos.length)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/70 rounded-full p-1"><ChevronLeft className="w-5 h-5 text-foreground" /></button>
                    <button onClick={() => setGalleryIndex((i) => (i + 1) % photos.length)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/70 rounded-full p-1"><ChevronRight className="w-5 h-5 text-foreground" /></button>
                  </>
                )}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-background/70 rounded-full px-2 py-0.5 text-xs text-foreground">{galleryIndex + 1}/{photos.length}</div>
              </div>
              {photos.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {photos.map((p, i) => (
                    <button key={p.id} onClick={() => setGalleryIndex(i)} className={`w-14 h-14 rounded-md overflow-hidden flex-shrink-0 border-2 ${i === galleryIndex ? "border-primary" : "border-transparent"}`}>
                      <img src={p.media_url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Video */}
        {videos.length > 0 && (
          <Card className="bg-card/80 border-border">
            <CardContent className="py-4 space-y-3">
              <h3 className="font-cinzel text-sm text-primary flex items-center gap-2">
                <Video className="w-4 h-4" /> Vídeo
              </h3>
              <video src={videos[0].media_url} controls className="w-full rounded-lg max-h-80" />
            </CardContent>
          </Card>
        )}

        {/* Action buttons for non-logged users */}
        {!user && (
          <div className="text-center">
            <Button onClick={() => navigate("/")} className="bg-primary text-primary-foreground font-cinzel">
              Cadastre-se para interagir
            </Button>
          </div>
        )}

        {/* User Posts */}
        <div className="space-y-4">
          <h3 className="font-cinzel text-lg text-primary text-center">Publicações</h3>
          {userPosts.length > 0 ? (
            userPosts.map((post: any) => <PostCard key={post.id} post={post} />)
          ) : (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhuma publicação ainda.</p>
          )}
        </div>
      </main>
    </div>
  );
};

export default ProfileByName;
