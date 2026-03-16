import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MailCheck, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const EmailVerificationGate = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [resending, setResending] = useState(false);

  if (isLoading || !user) return <>{children}</>;

  // Check if email is confirmed
  const isConfirmed = user.email_confirmed_at || user.confirmed_at;

  if (isConfirmed) return <>{children}</>;

  const handleResend = async () => {
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: user.email!,
      });
      if (error) throw error;
      toast({ title: "📧 Email reenviado!", description: "Verifique sua caixa de entrada e spam." });
    } catch {
      toast({ title: "Erro ao reenviar", variant: "destructive" });
    } finally {
      setResending(false);
    }
  };

  const handleRefresh = async () => {
    // Refresh the session to check if email was verified
    const { data } = await supabase.auth.refreshSession();
    if (data.user?.email_confirmed_at || data.user?.confirmed_at) {
      window.location.reload();
    } else {
      toast({ title: "Email ainda não verificado", description: "Clique no link enviado ao seu email." });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="bg-card border border-border rounded-2xl p-8 space-y-5">
          <MailCheck className="w-16 h-16 text-primary mx-auto" />
          <h1 className="font-cinzel text-2xl text-primary">Verifique seu Email</h1>
          <p className="text-muted-foreground text-sm">
            Enviamos um link de verificação para <span className="text-foreground font-semibold">{user.email}</span>.
          </p>
          <p className="text-muted-foreground text-xs">
            Verifique sua caixa de entrada e pasta de spam. Clique no link para ativar sua conta.
          </p>

          <div className="space-y-3 pt-2">
            <Button
              onClick={handleRefresh}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-cinzel"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Já verifiquei, continuar
            </Button>
            <Button
              onClick={handleResend}
              variant="outline"
              className="w-full border-border text-foreground"
              disabled={resending}
            >
              {resending ? "Reenviando..." : "📧 Reenviar email de verificação"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationGate;
