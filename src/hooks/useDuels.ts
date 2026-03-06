import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Duel {
  id: string;
  challenger_id: string;
  challenged_id: string;
  status: "pending" | "active" | "completed" | "refused";
  winner_id: string | null;
  challenger_votes: number;
  challenged_votes: number;
  created_at: string;
  resolved_at: string | null;
  stake_amount?: number;
  duel_type?: "normal" | "fatalite";
  challenger_profile?: { name: string; avatar_url: string | null; total_likes: number };
  challenged_profile?: { name: string; avatar_url: string | null; total_likes: number };
}

export function useDuels() {
  const { user } = useAuth();
  const [duels, setDuels] = useState<Duel[]>([]);
  const [pendingDuels, setPendingDuels] = useState<Duel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDuels = async () => {
    const { data, error } = await supabase
      .from("duels")
      .select(`
        *,
        challenger_profile:profiles!duels_challenger_id_fkey(name, avatar_url, total_likes),
        challenged_profile:profiles!duels_challenged_id_fkey(name, avatar_url, total_likes)
      `)
      .in("status", ["pending", "active", "completed", "refused"])
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && data) {
      setDuels(data.map((d: any) => ({
        ...d,
        challenger_profile: d.challenger_profile,
        challenged_profile: d.challenged_profile,
        // Read stake info from metadata or columns if they exist
        stake_amount: d.stake_amount ?? 100,
        duel_type: d.duel_type ?? "normal",
      })));
    }
    setIsLoading(false);
  };

  const fetchPending = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("duels")
      .select(`
        *,
        challenger_profile:profiles!duels_challenger_id_fkey(name, avatar_url, total_likes),
        challenged_profile:profiles!duels_challenged_id_fkey(name, avatar_url, total_likes)
      `)
      .eq("status", "pending")
      .or(`challenged_id.eq.${user.id},challenger_id.eq.${user.id}`);

    if (data) setPendingDuels(data.map((d: any) => ({
      ...d,
      stake_amount: d.stake_amount ?? 100,
      duel_type: d.duel_type ?? "normal",
    })));
  };

  useEffect(() => {
    fetchDuels();
    fetchPending();

    const channel = supabase
      .channel("duels-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "duels" }, () => {
        fetchDuels();
        fetchPending();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "duel_votes" }, () => {
        fetchDuels();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const challengeUser = async (challengedId: string, stakeAmount: number = 100, duelType: "normal" | "fatalite" = "normal") => {
    if (!user) return;
    if (challengedId === user.id) {
      toast.error("Você não pode desafiar a si mesmo!");
      return;
    }

    const insertData: any = {
      challenger_id: user.id,
      challenged_id: challengedId,
    };

    // Try to include stake columns (they may or may not exist in DB)
    try {
      const { error } = await supabase.from("duels").insert({
        ...insertData,
        stake_amount: duelType === "fatalite" ? 0 : stakeAmount,
        duel_type: duelType,
      });

      if (error) {
        // Fallback without stake columns
        const { error: error2 } = await supabase.from("duels").insert(insertData);
        if (error2) {
          toast.error("Erro ao criar desafio");
          return;
        }
      }
    } catch {
      const { error } = await supabase.from("duels").insert(insertData);
      if (error) {
        toast.error("Erro ao criar desafio");
        return;
      }
    }

    // Notify challenged user
    const stakeLabel = duelType === "fatalite" ? "FATALITÉ ☠️ (tudo ou nada!)" : `${stakeAmount} likes`;
    await supabase.from("notifications").insert({
      user_id: challengedId,
      tipo: "duelo",
      from_user_id: user.id,
      mensagem: `⚔️ Você foi desafiado para um duelo ${stakeLabel}! Aceite ou recuse.`,
    });

    toast.success(`Desafio ${stakeLabel} enviado! ⚔️`);
    fetchDuels();
    fetchPending();
  };

  const acceptDuel = async (duelId: string) => {
    const { error } = await supabase
      .from("duels")
      .update({ status: "active" })
      .eq("id", duelId);

    if (!error) {
      toast.success("Duelo aceito! 7 dias de batalha começam agora! ⚔️");
      fetchDuels();
      fetchPending();
    }
  };

  const refuseDuel = async (duel: Duel) => {
    await supabase
      .from("duels")
      .update({ status: "refused", resolved_at: new Date().toISOString() })
      .eq("id", duel.id);

    // Penalty: refused user loses 10 likes, challenger gains 10
    const { data: challengedProfile } = await supabase
      .from("profiles")
      .select("total_likes")
      .eq("user_id", duel.challenged_id)
      .single();

    const { data: challengerProfile } = await supabase
      .from("profiles")
      .select("total_likes")
      .eq("user_id", duel.challenger_id)
      .single();

    if (challengedProfile && challengerProfile) {
      await supabase
        .from("profiles")
        .update({ total_likes: Math.max(0, challengedProfile.total_likes - 10) })
        .eq("user_id", duel.challenged_id);

      await supabase
        .from("profiles")
        .update({ total_likes: challengerProfile.total_likes + 10 })
        .eq("user_id", duel.challenger_id);
    }

    // Notify challenger
    await supabase.from("notifications").insert({
      user_id: duel.challenger_id,
      tipo: "duelo",
      from_user_id: duel.challenged_id,
      mensagem: "😤 Seu oponente ARREGOU! +10 likes para você!",
    });

    toast.info("Desafio recusado! -10 likes para quem arregou 😔");
    fetchDuels();
    fetchPending();
  };

  const resolveDuel = async (duelId: string) => {
    const duel = duels.find((d) => d.id === duelId);
    if (!duel || duel.status !== "active") return;

    const challengerWins = duel.challenger_votes > duel.challenged_votes;
    const tie = duel.challenger_votes === duel.challenged_votes;
    const winnerId = tie ? null : challengerWins ? duel.challenger_id : duel.challenged_id;
    const loserId = tie ? null : challengerWins ? duel.challenged_id : duel.challenger_id;

    await supabase
      .from("duels")
      .update({ status: "completed", winner_id: winnerId, resolved_at: new Date().toISOString() })
      .eq("id", duelId);

    if (tie) {
      toast.info("Duelo empatou! Ninguém perde likes.");
      fetchDuels();
      return;
    }

    if (duel.duel_type === "fatalite" && loserId && winnerId) {
      // FATALITÉ: loser goes to 0 likes + eliminated 3 days
      const { data: loserProfile } = await supabase
        .from("profiles")
        .select("total_likes")
        .eq("user_id", loserId)
        .single();

      const { data: winnerProfile } = await supabase
        .from("profiles")
        .select("total_likes")
        .eq("user_id", winnerId)
        .single();

      if (loserProfile && winnerProfile) {
        // Winner gets all loser's likes
        await supabase
          .from("profiles")
          .update({ total_likes: winnerProfile.total_likes + loserProfile.total_likes })
          .eq("user_id", winnerId);

        // Loser goes to 0 (will be auto-eliminated by existing system)
        await supabase
          .from("profiles")
          .update({ total_likes: 0 })
          .eq("user_id", loserId);
      }

      await supabase.from("notifications").insert([
        { user_id: winnerId, tipo: "duelo", from_user_id: loserId, mensagem: "🏆 FATALITÉ! Você VENCEU e ganhou TODOS os likes do oponente! ☠️" },
        { user_id: loserId, tipo: "duelo", from_user_id: winnerId, mensagem: "☠️ FATALITÉ! Você PERDEU tudo! 0 likes + Eliminado 3 dias!" },
      ]);

      toast.success("FATALITÉ resolvido! ☠️");
    } else if (loserId && winnerId) {
      // Normal duel: transfer stake_amount likes
      const stakeAmount = duel.stake_amount || 100;

      const { data: loserProfile } = await supabase
        .from("profiles")
        .select("total_likes")
        .eq("user_id", loserId)
        .single();

      const { data: winnerProfile } = await supabase
        .from("profiles")
        .select("total_likes")
        .eq("user_id", winnerId)
        .single();

      if (loserProfile && winnerProfile) {
        await supabase
          .from("profiles")
          .update({ total_likes: Math.max(0, loserProfile.total_likes - stakeAmount) })
          .eq("user_id", loserId);

        await supabase
          .from("profiles")
          .update({ total_likes: winnerProfile.total_likes + stakeAmount })
          .eq("user_id", winnerId);
      }

      await supabase.from("notifications").insert([
        { user_id: winnerId, tipo: "duelo", from_user_id: loserId, mensagem: `🏆 Você VENCEU o duelo e ganhou ${stakeAmount} likes!` },
        { user_id: loserId, tipo: "duelo", from_user_id: winnerId, mensagem: `😔 Você PERDEU o duelo e perdeu ${stakeAmount} likes!` },
      ]);

      toast.success("Duelo resolvido! ⚔️");
    }

    fetchDuels();
    fetchPending();
  };

  const voteDuel = async (duelId: string, votedFor: string, voteType: "play" | "likes") => {
    if (!user) return;

    const voteValue = voteType === "play" ? 1 : 100;

    const { error } = await supabase.from("duel_votes").insert({
      duel_id: duelId,
      voter_id: user.id,
      voted_for: votedFor,
      vote_type: voteType,
      vote_value: voteValue,
    });

    if (error) {
      if (error.code === "23505") {
        toast.error("Você já votou neste duelo!");
      } else {
        toast.error("Erro ao votar");
      }
      return;
    }

    // Update duel vote counts
    const duel = duels.find((d) => d.id === duelId);
    if (duel) {
      const field = votedFor === duel.challenger_id ? "challenger_votes" : "challenged_votes";
      const currentVotes = votedFor === duel.challenger_id ? duel.challenger_votes : duel.challenged_votes;
      await supabase
        .from("duels")
        .update({ [field]: currentVotes + voteValue })
        .eq("id", duelId);
    }

    toast.success(`Voto registrado! ${voteType === "play" ? "💎 1 Play" : "❤️ 100 Likes"}`);
    fetchDuels();
  };

  return {
    duels,
    pendingDuels,
    isLoading,
    challengeUser,
    acceptDuel,
    refuseDuel,
    voteDuel,
    resolveDuel,
    refresh: fetchDuels,
  };
}
