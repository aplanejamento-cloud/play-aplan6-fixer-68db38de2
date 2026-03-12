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

// SOS uses the notifications table with tipo='sos' and tipo='sos_reply'
// No separate table needed

export function useSosPendingCount() {
  return useQuery({
    queryKey: ["sos-pending-count"],
    queryFn: async () => {
      try {
        const { count, error } = await supabase
          .from("notifications" as any)
          .select("*", { count: "exact", head: true })
          .eq("tipo", "sos")
          .eq("lido", false);
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
      try {
        // Fetch all SOS notifications
        const { data: sosNotifs, error } = await supabase
          .from("notifications" as any)
          .select("*")
          .eq("tipo", "sos")
          .order("created_at", { ascending: false });

        if (error || !sosNotifs) return [] as SosRequest[];

        // Fetch replies
        const { data: replyNotifs } = await supabase
          .from("notifications" as any)
          .select("*")
          .eq("tipo", "sos_reply");

        const replyMap = new Map<string, string>();
        (replyNotifs || []).forEach((r: any) => {
          // post_id stores the original SOS notification id
          if (r.post_id) replyMap.set(r.post_id, r.mensagem || "");
        });

        // Fetch profiles
        const userIds = [...new Set(sosNotifs.map((d: any) => d.from_user_id || d.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, name, avatar_url")
          .in("user_id", userIds);

        const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

        return sosNotifs.map((d: any) => {
          const senderId = d.from_user_id || d.user_id;
          const hasReply = replyMap.has(d.id);
          return {
            id: d.id,
            user_id: senderId,
            message: d.mensagem || "",
            media_urls: [],
            status: hasReply ? "respondido" : "pendente",
            admin_reply: replyMap.get(d.id) || null,
            created_at: d.created_at,
            profile: profileMap.get(senderId) || null,
          } as SosRequest;
        });
      } catch {
        return [] as SosRequest[];
      }
    },
  });
}

export function useCreateSos() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ message }: { message: string; mediaUrls?: string[] }) => {
      if (!user) throw new Error("Login necessário");

      // Find admin users to notify
      const { data: adminRoles } = await supabase
        .rpc("has_role", { _user_id: user.id, _role: "admin" });

      // Get all admin user_ids from user_roles
      const { data: admins } = await supabase
        .from("user_roles" as any)
        .select("user_id")
        .eq("role", "admin");

      const adminIds = (admins || []).map((a: any) => a.user_id);

      // Create SOS notification for each admin
      for (const adminId of adminIds) {
        await supabase.from("notifications" as any).insert({
          user_id: adminId,
          tipo: "sos",
          from_user_id: user.id,
          mensagem: message,
          lido: false,
        });
      }

      // Also create one for self to track
      if (!adminIds.includes(user.id)) {
        await supabase.from("notifications" as any).insert({
          user_id: user.id,
          tipo: "sos",
          from_user_id: user.id,
          mensagem: message,
          lido: true,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sos-requests"] });
      queryClient.invalidateQueries({ queryKey: ["sos-pending-count"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("SOS enviado! O admin será notificado.");
    },
  });
}

export function useReplySos() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reply }: { id: string; reply: string }) => {
      // Get the original SOS to find the sender
      const { data: original } = await supabase
        .from("notifications" as any)
        .select("*")
        .eq("id", id)
        .single();

      if (!original) throw new Error("SOS não encontrado");

      const senderId = (original as any).from_user_id || (original as any).user_id;

      // Create reply notification for the sender
      await supabase.from("notifications" as any).insert({
        user_id: senderId,
        tipo: "sos_reply",
        post_id: id, // reference to original SOS
        mensagem: reply,
        lido: false,
      });

      // Mark original as read
      await supabase
        .from("notifications" as any)
        .update({ lido: true } as any)
        .eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sos-requests"] });
      queryClient.invalidateQueries({ queryKey: ["sos-pending-count"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Resposta enviada!");
    },
  });
}
