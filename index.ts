import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("[Webhook MP] Received:", JSON.stringify(body));

    // Mercado Pago sends action: "payment.created" or "payment.updated"
    if (body.action !== "payment.updated" && body.action !== "payment.created") {
      return new Response("OK - ignored", { headers: corsHeaders });
    }

    const paymentId = body.data?.id;
    if (!paymentId) {
      return new Response("OK - no payment id", { headers: corsHeaders });
    }

    const MP_ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!MP_ACCESS_TOKEN) {
      console.error("[Webhook MP] MERCADOPAGO_ACCESS_TOKEN not configured");
      return new Response("OK - no token", { headers: corsHeaders });
    }

    // Fetch payment details from MP
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });
    const payment = await mpResponse.json();

    console.log("[Webhook MP] Payment status:", payment.status, "metadata:", payment.metadata);

    if (payment.status !== "approved") {
      return new Response("OK - not approved", { headers: corsHeaders });
    }

    const { tipo, usuario_id, likes, valor } = payment.metadata || {};
    if (!usuario_id) {
      console.error("[Webhook MP] No usuario_id in metadata");
      return new Response("OK - no user", { headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Update compras_pix status to approved (match by usuario_id + valor + pendente)
    await supabase
      .from("compras_pix")
      .update({ status: "aprovado" })
      .eq("usuario_id", usuario_id)
      .eq("status", "pendente")
      .eq("valor", Number(valor))
      .order("created_at", { ascending: false })
      .limit(1);

    // Credit based on type
    const { data: profile } = await supabase
      .from("profiles")
      .select("total_likes")
      .eq("user_id", usuario_id)
      .single();

    if (tipo === "likes" || tipo === "renovacao") {
      const addLikes = Number(likes) || 1000;
      await supabase
        .from("profiles")
        .update({ total_likes: (profile?.total_likes || 0) + addLikes })
        .eq("user_id", usuario_id);
    } else if (tipo === "turbo" || tipo === "turbo_bomba") {
      const end = new Date();
      end.setDate(end.getDate() + 7);
      await supabase
        .from("profiles")
        .update({
          multiplicador_ativo: 10,
          multiplicador_end: end.toISOString(),
        })
        .eq("user_id", usuario_id);
    } else if (tipo === "premium") {
      const end = new Date();
      end.setDate(end.getDate() + 30);
      await supabase
        .from("profiles")
        .update({
          premium_active: true,
          premium_end: end.toISOString(),
        })
        .eq("user_id", usuario_id);
    }

    // Create notification
    const tipoLabels: Record<string, string> = {
      likes: `+${likes} likes`,
      turbo: "Turbo x10 ativado!",
      turbo_bomba: "Turbo Bomba ativado!",
      premium: "Premium ativado!",
      renovacao: "Cadastro renovado!",
    };

    await supabase.from("notifications").insert({
      user_id: usuario_id,
      tipo: "pix_aprovado",
      mensagem: `✅ PIX aprovado! ${tipoLabels[tipo] || `+${likes} likes`}`,
    });

    // WhatsApp notification (best effort)
    try {
      await supabase.functions.invoke("send-whatsapp", {
        body: { usuario_id, tipo, likes },
      });
    } catch (e) {
      console.warn("[Webhook MP] WhatsApp fallback:", e);
    }

    console.log(`[Webhook MP] ✅ Auto-approved: ${tipo} for ${usuario_id}`);

    return new Response("OK", { headers: corsHeaders });
  } catch (e) {
    console.error("[Webhook MP] Error:", e);
    return new Response("OK", { headers: corsHeaders });
  }
});
