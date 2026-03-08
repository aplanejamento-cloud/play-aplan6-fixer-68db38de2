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
    const MP_ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");

    if (!MP_ACCESS_TOKEN) {
      return new Response(
        JSON.stringify({
          error: "MERCADOPAGO_ACCESS_TOKEN não configurado",
          placeholder: true,
          // Return mock data for testing without real MP
          qr_code: "PLACEHOLDER_PIX_CODE_00020126580014br.gov.bcb.pix0136playlike",
          qr_code_base64: "",
          payment_id: "placeholder_" + Date.now(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    const { tipo, valor, likes } = await req.json();

    if (!tipo || !valor) {
      return new Response(
        JSON.stringify({ error: "tipo e valor são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const titleMap: Record<string, string> = {
      likes: `Carregar ${likes} Likes PlayLike`,
      turbo: "Turbo Likes x10 PlayLike",
      turbo_bomba: "Turbo Bomba x10 PlayLike",
      premium: "Premium 30 dias PlayLike",
      renovacao: "Renovação Cadastro PlayLike",
    };

    // Create Mercado Pago payment via API
    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `${userId}-${tipo}-${Date.now()}`,
      },
      body: JSON.stringify({
        transaction_amount: Number(valor),
        description: titleMap[tipo] || "PlayLike PIX",
        payment_method_id: "pix",
        payer: { email: `user-${userId.slice(0, 8)}@playlike.com.br` },
        metadata: { tipo, usuario_id: userId, likes: Number(likes), valor: Number(valor) },
      }),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("[MP] Error creating payment:", mpData);
      return new Response(
        JSON.stringify({ error: "Erro ao criar pagamento MP", details: mpData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const qrCode = mpData.point_of_interaction?.transaction_data?.qr_code || "";
    const qrBase64 = mpData.point_of_interaction?.transaction_data?.qr_code_base64 || "";

    // Save to compras_pix using service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await supabaseAdmin.from("compras_pix").insert({
      usuario_id: userId,
      valor: Number(valor),
      likes_adquiridos: Number(likes) || 0,
      pix_copia: qrCode,
      status: "pendente",
      tipo,
    });

    return new Response(
      JSON.stringify({
        qr_code: qrCode,
        qr_code_base64: qrBase64,
        payment_id: mpData.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[create-pix-payment] Error:", e);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
