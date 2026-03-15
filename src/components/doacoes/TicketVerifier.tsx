import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { sendWhatsAppDoador } from "@/services/WhatsAppService";

interface TicketVerifierProps {
  doacaoId: string;
  doacaoUserId: string;
  likesRecebidos: number;
}

const TicketVerifier = ({ doacaoId, doacaoUserId, likesRecebidos }: TicketVerifierProps) => {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const qc = useQueryClient();

  const handleVerify = async () => {
    if (code.length !== 6) { toast.error("Digite o código de 6 dígitos"); return; }
    setVerifying(true);
    setResult(null);
    try {
      const { data: resgate, error: rErr } = await supabase
        .from("resgates")
        .select("*")
        .eq("codigo_ticket", code)
        .maybeSingle();

      if (rErr || !resgate) {
        setResult({ success: false, message: "Senha inválida" });
        toast.error("Senha inválida");
        setVerifying(false);
        return;
      }

      if (resgate.likes_transferidos) {
        setResult({ success: false, message: "Já transferido anteriormente" });
        toast.error("Já transferido");
        setVerifying(false);
        return;
      }

      const claimedUserId = resgate.usuario_id;
      const likesGastos = resgate.likes_gastos || likesRecebidos;

      const { data: claimedUser } = await supabase
        .from("profiles")
        .select("total_likes, user_id")
        .eq("user_id", claimedUserId)
        .single();

      if (!claimedUser || claimedUser.total_likes! < likesGastos) {
        setResult({ success: false, message: "Usuário sem likes suficientes" });
        toast.error("Usuário sem likes suficientes");
        setVerifying(false);
        return;
      }

      const { data: doador } = await supabase
        .from("profiles")
        .select("total_likes, user_id")
        .eq("user_id", doacaoUserId)
        .single();

      if (!doador) {
        setResult({ success: false, message: "Doador não encontrado" });
        setVerifying(false);
        return;
      }

      await supabase.from("profiles")
        .update({ total_likes: doador!.total_likes! + likesGastos })
        .eq("user_id", doacaoUserId);

      await supabase.from("profiles")
        .update({ total_likes: claimedUser.total_likes! - likesGastos })
        .eq("user_id", claimedUserId);

      await supabase.from("resgates")
        .update({ likes_transferidos: true, status: "Aprovado e entregue" })
        .eq("id", resgate.id);

      const premioId = resgate.premio_id;
      if (premioId) {
        const { data: premio } = await supabase.from("premios").select("estoque").eq("id", premioId).single();
        if (premio) {
          await supabase.from("premios").update({ estoque: Math.max(0, premio.estoque! - 1) }).eq("id", premioId);
        }
      }

      const { data: premioData } = await supabase.from("premios").select("titulo").eq("id", premioId).single();
      const premioTitulo = premioData?.titulo || "prêmio";

      await supabase.from("notifications").insert({
        user_id: doacaoUserId,
        tipo: "premio",
        from_user_id: claimedUserId,
        mensagem: `🎉 Você recebeu ${likesGastos} likes da sua ${premioTitulo}!`,
      });

      const { data: doadorProfile } = await supabase
        .from("profiles")
        .select("whatsapp")
        .eq("user_id", doacaoUserId)
        .single();

      const whatsappSent = await sendWhatsAppDoador(
        doadorProfile?.whatsapp || null,
        likesGastos,
        premioTitulo
      );

      qc.invalidateQueries({ queryKey: ["minhas_doacoes"] });
      qc.invalidateQueries({ queryKey: ["premios"] });
      setResult({ success: true, message: `✅ Likes transferidos! +${likesGastos} likes para você.` });
      toast.success(`🎉 +${likesGastos} likes${whatsappSent ? " + WhatsApp enviado" : ""}! Estoque -1`);
    } catch (e: any) {
      setResult({ success: false, message: e.message || "Erro ao verificar" });
      toast.error("Erro ao verificar ticket");
    }
    setVerifying(false);
  };

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-2">
        <Input
          placeholder="Senha 6 dígitos"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          maxLength={6}
          className="font-mono text-center text-lg tracking-widest"
        />
        <Button size="sm" onClick={handleVerify} disabled={verifying || code.length !== 6}>
          {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
      {result && (
        <p className={cn("text-xs font-medium", result.success ? "text-green-500" : "text-destructive")}>
          {result.message}
          {!result.success && result.message !== "Já transferido anteriormente" && (
            <span className="block text-destructive font-bold mt-1">⚠️ NÃO entregue o produto!</span>
          )}
        </p>
      )}
    </div>
  );
};

export default TicketVerifier;
