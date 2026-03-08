import { supabase } from "@/integrations/supabase/client";

/**
 * Envia notificação WhatsApp para o doador quando ticket é verificado.
 * Usa edge function como proxy para WhatsApp Business API.
 * Fallback: notificação in-app já é criada no TicketVerifier.
 */
export async function sendWhatsAppDoador(
  doadorTelefone: string | null,
  likes: number,
  premio: string
): Promise<boolean> {
  if (!doadorTelefone) {
    console.log("[WhatsApp] Doador sem telefone cadastrado - notificação in-app apenas");
    return false;
  }

  const mensagem = `🎉 Você recebeu ${likes} likes da sua ${premio}! playlike.com.br`;

  try {
    const { error } = await supabase.functions.invoke("send-whatsapp", {
      body: {
        telefone: doadorTelefone,
        mensagem,
      },
    });

    if (error) {
      console.warn("[WhatsApp] Falha ao enviar - fallback notificação in-app:", error.message);
      return false;
    }

    console.log("[WhatsApp] Mensagem enviada com sucesso para", doadorTelefone);
    return true;
  } catch (e) {
    console.warn("[WhatsApp] Serviço indisponível - fallback notificação in-app:", e);
    return false;
  }
}
