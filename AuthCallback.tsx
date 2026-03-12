import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Check if profile exists
        const { data: existing } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", session.user.id)
          .single();

        if (!existing) {
          const meta = session.user.user_metadata || {};
          await supabase.from("profiles").insert({
            user_id: session.user.id,
            name: meta.full_name || meta.name || "Usuário",
            avatar_url: meta.avatar_url || meta.picture || null,
            user_type: "jogador",
            total_likes: 1000,
          } as any);
        }
        navigate("/feed", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    };
    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
        <p className="text-primary font-cinzel text-xl">Carregando...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
