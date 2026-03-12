import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FeedTab } from "@/types/feed";
import { usePosts } from "@/hooks/usePosts";
import { useAuth } from "@/contexts/AuthContext";
import { useDuels } from "@/hooks/useDuels";
import PostCard from "./PostCard";
import { Loader2, Inbox, RefreshCw, Swords, Crown, Skull, Heart, Gem, Timer } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { differenceInDays, addDays } from "date-fns";

interface FeedListProps {
  tab: FeedTab;
}

const emptyMessages: Record<FeedTab, { title: string; description: string }> = {
  "na-tela": { title: "Nenhum post ainda", description: "Seja o primeiro a publicar e apareça no Top 100!" },
  "acontecendo": { title: "Nada acontecendo", description: "Não há posts nas últimas 24 horas. Que tal criar um?" },
  "fan-club": { title: "Seu Fan Club está vazio", description: "Siga outros jogadores para ver os posts deles aqui!" },
  "lacrou": { title: "Nenhum post lacrou ainda", description: "Posts com +1.000 likes aparecem aqui. Continue interagindo!" },
  "bomba": { title: "Nenhuma bomba", description: "Posts com -1.000 likes ou menos aparecem aqui. Cuidado!" },
  "duelos": { title: "Nenhum duelo ativo", description: "Desafie alguém na página de Duelos!" },
  "cultura": { title: "Nenhum post cultural", description: "Use os templates para postar conteúdo cultural com boost!" },
};

const DuelosFeed = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { voteDuel, resolveDuel } = useDuels();

  const { data: duels = [], isLoading } = useQuery({
    queryKey: ["duels-feed"],
    queryFn: async () => {
      const { data } = await supabase
        .from("duels")
        .select("*")
        .in("status", ["active", "completed", "refused"])
        .order("created_at", { ascending: false })
        .limit(50);
      if (!data?.length) return [];

      const userIds = [...new Set(data.flatMap((d) => [d.challenger_id, d.challenged_id]))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name, avatar_url, total_likes")
        .in("user_id", userIds);

      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
      return data.map((d) => ({
        ...d,
        challenger: profileMap.get(d.challenger_id),
        challenged: profileMap.get(d.challenged_id),
        stake_amount: d.stake_amount ?? 100,
        duel_type: d.duel_type ?? "normal",
      }));
    },
    refetchInterval: 15000,
  });

  const getDaysRemaining = (duel: any) => {
    const start = new Date(duel.created_at);
    const end = addDays(start, 7);
    return Math.max(0, differenceInDays(end, new Date()));
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!duels.length) return (
    <div className="text-center py-12 space-y-3">
      <Inbox className="w-12 h-12 mx-auto text-muted-foreground/50" />
      <h3 className="font-cinzel text-lg text-foreground">Nenhum duelo ativo</h3>
      <p className="text-sm text-muted-foreground">Desafie alguém na página de Duelos!</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {duels.map((duel: any) => (
        <div key={duel.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
          {/* Status row */}
          <div className="flex justify-between items-center flex-wrap gap-2">
            <span className={cn(
              "text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1",
              duel.status === "active" ? "bg-green-500/20 text-green-500" :
              duel.status === "refused" ? "bg-destructive/20 text-destructive" :
              "bg-primary/20 text-primary"
            )}>
              {duel.status === "active" && <><Swords className="w-3 h-3" /> AO VIVO · {getDaysRemaining(duel)}d</>}
              {duel.status === "refused" && <><Skull className="w-3 h-3" /> ARREGOU</>}
              {duel.status === "completed" && <><Crown className="w-3 h-3" /> FINALIZADO</>}
            </span>
            <span className={cn(
              "text-xs px-2 py-0.5 rounded-full font-bold",
              duel.duel_type === "fatalite" ? "bg-destructive/20 text-destructive" : "bg-primary/10 text-primary"
            )}>
              {duel.duel_type === "fatalite" ? "☠️ FATALITÉ" : `${duel.stake_amount} likes`}
            </span>
          </div>

          {/* VS layout with clickable avatars */}
          <div className="flex items-center justify-around">
            <button
              className="text-center flex-1 hover:opacity-80 transition-opacity"
              onClick={() => navigate(`/profile/${duel.challenger_id}`)}
            >
              <Avatar className={cn("w-14 h-14 mx-auto border-2", duel.winner_id === duel.challenger_id ? "border-primary" : "border-border")}>
                <AvatarImage src={duel.challenger?.avatar_url || ""} />
                <AvatarFallback className="bg-secondary text-foreground font-bold">{duel.challenger?.name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <p className="text-xs font-medium text-foreground truncate mt-1">{duel.challenger?.name}</p>
              <p className="text-sm text-primary font-bold">{duel.challenger_votes} votos</p>
              {duel.winner_id === duel.challenger_id && <Crown className="w-4 h-4 text-primary mx-auto" />}
            </button>

            <div className="text-center px-2">
              <span className="font-cinzel text-xl text-accent glow-purple">VS</span>
              {duel.duel_type === "fatalite" && duel.status === "active" && (
                <p className="text-[10px] text-destructive font-bold">☠️</p>
              )}
            </div>

            <button
              className="text-center flex-1 hover:opacity-80 transition-opacity"
              onClick={() => navigate(`/profile/${duel.challenged_id}`)}
            >
              <Avatar className={cn("w-14 h-14 mx-auto border-2", duel.winner_id === duel.challenged_id ? "border-primary" : "border-border")}>
                <AvatarImage src={duel.challenged?.avatar_url || ""} />
                <AvatarFallback className="bg-secondary text-foreground font-bold">{duel.challenged?.name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <p className="text-xs font-medium text-foreground truncate mt-1">{duel.challenged?.name}</p>
              <p className="text-sm text-accent font-bold">{duel.challenged_votes} votos</p>
              {duel.winner_id === duel.challenged_id && <Crown className="w-4 h-4 text-primary mx-auto" />}
            </button>
          </div>

          {/* Vote buttons for active duels */}
          {duel.status === "active" && user && duel.challenger_id !== user.id && duel.challenged_id !== user.id && (
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border">
              <div className="space-y-1">
                <p className="text-[10px] text-center text-muted-foreground pt-1">{duel.challenger?.name?.split(" ")[0]}</p>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => voteDuel(duel.id, duel.challenger_id, "play")} className="flex-1 text-xs border-accent text-accent h-7">
                    <Gem className="w-3 h-3 mr-0.5" />1
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => voteDuel(duel.id, duel.challenger_id, "likes")} className="flex-1 text-xs border-primary text-primary h-7">
                    <Heart className="w-3 h-3 mr-0.5" />100
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-center text-muted-foreground pt-1">{duel.challenged?.name?.split(" ")[0]}</p>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => voteDuel(duel.id, duel.challenged_id, "play")} className="flex-1 text-xs border-accent text-accent h-7">
                    <Gem className="w-3 h-3 mr-0.5" />1
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => voteDuel(duel.id, duel.challenged_id, "likes")} className="flex-1 text-xs border-primary text-primary h-7">
                    <Heart className="w-3 h-3 mr-0.5" />100
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          {/* Admin Resolve Button */}
          {user?.id === "1" && duel.status === "active" && (
            <div className="pt-2 border-t border-border mt-2">
              <Button size="sm" variant="destructive" className="w-full text-xs h-7" onClick={() => resolveDuel(duel.id)}>
                Admin: Encerrar Duelo
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// Fisher-Yates shuffle
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const FeedList = ({ tab }: FeedListProps) => {
  const { posts, isLoading, error, refetch } = usePosts(tab === "duelos" ? "na-tela" : tab === "cultura" ? "cultura" : tab);
  const [shuffledPosts, setShuffledPosts] = useState<typeof posts | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    const { data } = await refetch();
    setShuffledPosts(shuffle(data || posts));
    setTimeout(() => setRefreshing(false), 400);
  }, [refetch, posts]);

  useEffect(() => {
    setShuffledPosts(null);
  }, [tab]);

  if (tab === "duelos") return <DuelosFeed />;

  const displayPosts = shuffledPosts || posts;

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (error) return <div className="text-center py-12 text-destructive"><p>Erro ao carregar posts</p></div>;

  if (displayPosts.length === 0) {
    const message = emptyMessages[tab];
    return (
      <div className="text-center py-12 space-y-3">
        <Inbox className="w-12 h-12 mx-auto text-muted-foreground/50" />
        <h3 className="font-cinzel text-lg text-foreground">{message.title}</h3>
        <p className="text-sm text-muted-foreground">{message.description}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={handleRefresh}
        disabled={refreshing}
        className="w-full flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground hover:text-primary transition-colors"
      >
        <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
        {refreshing ? "Atualizando..." : "Puxe para misturar o feed 🔀"}
      </button>
      {displayPosts.map((post, idx) => <PostCard key={`${post.id}-${idx}`} post={post} />)}
    </div>
  );
};

export default FeedList;
