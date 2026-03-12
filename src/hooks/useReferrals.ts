import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ReferralShare {
  id: string;
  user_id: string;
  network: string;
  share_code: string;
  shared_at: string;
  verified_at: string | null;
  clicks_count: number;
  likes_awarded: boolean;
}

export function useReferrals() {
  const { user, refreshProfile } = useAuth();
  const [shares, setShares] = useState<ReferralShare[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchShares = async () => {
    if (!user) return;
    setIsLoading(true);
    const { data } = await supabase
      .from("referral_shares")
      .select("*")
      .eq("user_id", user.id)
      .order("shared_at", { ascending: false });
    setShares((data as ReferralShare[]) || []);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchShares();

    // Subscribe to realtime updates for shares
    if (user) {
      const channel = supabase
        .channel("referral-updates")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "referral_shares",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchShares();
            refreshProfile();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const generateShareCode = () => {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  };

  const createShare = async (network: string): Promise<{ shareCode: string; trackingUrl: string } | null> => {
    if (!user) return null;

    const shareCode = generateShareCode();
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const trackingUrl = `https://${projectId}.supabase.co/functions/v1/track-referral?code=${shareCode}`;

    const { error } = await supabase.from("referral_shares").insert({
      user_id: user.id,
      network,
      share_code: shareCode,
    } as any);

    if (error) {
      console.error("Error creating share:", error);
      return null;
    }

    await fetchShares();
    return { shareCode, trackingUrl };
  };

  // Stats
  const totalClicks = shares.reduce((sum, s) => sum + (s.clicks_count || 0), 0);
  const verifiedShares = shares.filter((s) => s.likes_awarded).length;
  const pendingShares = shares.filter((s) => !s.likes_awarded && s.clicks_count === 0).length;
  const networksUsed = [...new Set(shares.filter((s) => s.likes_awarded).map((s) => s.network))].length;
  const totalLikesEarned = shares.reduce((sum, s) => {
    if (!s.likes_awarded) return sum;
    // First use of network = 100, subsequent = 10
    const firstUseOfNetwork = shares.find(
      (other) => other.network === s.network && other.likes_awarded && other.shared_at <= s.shared_at
    );
    return sum + (firstUseOfNetwork?.id === s.id ? 100 : 10);
  }, 0);

  return {
    shares,
    isLoading,
    createShare,
    fetchShares,
    totalClicks,
    verifiedShares,
    pendingShares,
    networksUsed,
    totalLikesEarned,
  };
}
