import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface SosRequest {
  id: string;
  user_id: string;
  message: string;
  media_urls: string[];
  status: "pendente" | "respondido";
  admin_reply: string | null;
  created_at: string;
  profile?: { name: string; avatar_url: string | null };
}

export function useSosPendingCount() {
  return useQuery({
    queryKey: ["sos-pending-count"],
    queryFn: async () => {
      try {
        const { count, error } = await supabase
          .from("sos_ajuda" as any)
          .select("*", { count: "exact", head: true })
          .eq("status", "pendente");
        if (error) return 0;
        return count || 0;
      } catch {
        return 0;
      }
    },
    refetchInterval: 30000,
  });
}

export function useSosRequests() {
  return useQuery({
    queryKey: ["sos-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sos_ajuda" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) return [] as SosRequest[];

      const userIds = [...new Set((data || []).map((d: any) => d.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name, avatar_url")
        .in("user_id", userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      return (data || []).map((d: any) => ({
        ...d,
        media_urls: d.media_urls || [],
        profile: profileMap.get(d.user_id) || null,
      })) as SosRequest[];
    },
  });
}

export function useCreateSos() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ message, mediaUrls }: { message: string; mediaUrls?: string[] }) => {
      if (!user) throw new Error("Login necessário");
      const { error } = await supabase.from("sos_ajuda" as any).insert({
        user_id: user.id,
        message,
        media_urls: mediaUrls || [],
        status: "pendente",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sos-requests"] });
      queryClient.invalidateQueries({ queryKey: ["sos-pending-count"] });
      toast.success("SOS enviado! O admin será notificado.");
    },
  });
}

export function useReplySos() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reply }: { id: string; reply: string }) => {
      const { error } = await supabase
        .from("sos_ajuda" as any)
        .update({ status: "respondido", admin_reply: reply })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sos-requests"] });
      queryClient.invalidateQueries({ queryKey: ["sos-pending-count"] });
      toast.success("Resposta enviada!");
    },
  });
}
