import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGameState } from "@/hooks/useGameState";

const MAX_POSTS_PER_DAY = 3;

export function useJuizPostLimit() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const { gameState } = useGameState();

  const isJuiz = profile?.user_type === "juiz";
  const gameOn = gameState?.game_on ?? false;

  const { data: postsHoje = 0, isLoading } = useQuery({
    queryKey: ["juiz-posts-hoje", user?.id],
    queryFn: async (): Promise<number> => {
      if (!user || !isJuiz) return 0;

      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("juiz_posts_diarios" as any)
        .select("post_count")
        .eq("juiz_id", user.id)
        .eq("data", today)
        .maybeSingle();

      return (data as any)?.post_count ?? 0;
    },
    enabled: isJuiz && !!user,
    refetchInterval: 30_000,
  });

  // Juiz can only post if game is ON and under daily limit
  const canPost = isJuiz && gameOn && postsHoje < MAX_POSTS_PER_DAY;
  const remaining = Math.max(0, MAX_POSTS_PER_DAY - postsHoje);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["juiz-posts-hoje", user?.id] });
  };

  return { postsHoje, canPost, remaining, isLoading, isJuiz, gameOn, invalidate };
}
