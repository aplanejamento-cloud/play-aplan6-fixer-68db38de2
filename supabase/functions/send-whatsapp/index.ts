import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { telefone, mensagem } = await req.json();

    if (!telefone || !mensagem) {
      return new Response(
        JSON.stringify({ error: "telefone e mensagem são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PLACEHOLDER: Integre com WhatsApp Business API aqui
    // Quando tiver a API key, descomente e configure:
    //
    // const WHATSAPP_API_KEY = Deno.env.get("WHATSAPP_API_KEY");
    // const WHATSAPP_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID");
    //
    // const response = await fetch(
    //   `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`,
    //   {
    //     method: "POST",
    //     headers: {
    //       "Authorization": `Bearer ${WHATSAPP_API_KEY}`,
    //       "Content-Type": "application/json",
    //     },
    //     body: JSON.stringify({
    //       messaging_product: "whatsapp",
    //       to: telefone.replace(/\D/g, ""),
    //       type: "text",
    //       text: { body: mensagem },
    //     }),
    //   }
    // );

    console.log(`[WhatsApp PLACEHOLDER] Para: ${telefone} | Msg: ${mensagem}`);

    return new Response(
      JSON.stringify({
        success: true,
        placeholder: true,
        message: "WhatsApp placeholder - configure WHATSAPP_API_KEY para envio real",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
