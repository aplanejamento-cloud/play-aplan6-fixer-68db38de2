import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const shareCode = url.searchParams.get("code");

    if (!shareCode) {
      // Redirect to home if no code
      return new Response(null, {
        status: 302,
        headers: { Location: "https://playlike.lovable.app", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Find the share by code
    const { data: share, error: shareError } = await supabase
      .from("referral_shares")
      .select("id, user_id, network, likes_awarded, clicks_count")
      .eq("share_code", shareCode)
      .single();

    if (shareError || !share) {
      // Invalid code, redirect to home
      return new Response(null, {
        status: 302,
        headers: { Location: "https://playlike.lovable.app", ...corsHeaders },
      });
    }

    // Get IP hash for deduplication (hash for privacy)
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const encoder = new TextEncoder();
    const data = encoder.encode(ip + shareCode);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const ipHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);

    // Check if this IP already clicked this share
    const { data: existingClick } = await supabase
      .from("referral_clicks")
      .select("id")
      .eq("share_id", share.id)
      .eq("ip_hash", ipHash)
      .single();

    if (!existingClick) {
      // Record the click
      await supabase.from("referral_clicks").insert({
        share_id: share.id,
        ip_hash: ipHash,
        user_agent: req.headers.get("user-agent") || null,
      });

      // Update click count
      const newClickCount = (share.clicks_count || 0) + 1;
      await supabase
        .from("referral_shares")
        .update({ 
          clicks_count: newClickCount,
          verified_at: new Date().toISOString() 
        })
        .eq("id", share.id);

      // If first click and not yet awarded, give likes!
      if (!share.likes_awarded && newClickCount >= 1) {
        // Award 1000 likes for first time network use + 10 bonus
        const { data: existingNetworkUse } = await supabase
          .from("referral_shares")
          .select("id")
          .eq("user_id", share.user_id)
          .eq("network", share.network)
          .eq("likes_awarded", true)
          .single();

        const likesToAward = existingNetworkUse ? 10 : 1000;

        // Update profile total_likes
        const { data: profile } = await supabase
          .from("profiles")
          .select("total_likes")
          .eq("user_id", share.user_id)
          .single();

        if (profile) {
          await supabase
            .from("profiles")
            .update({ total_likes: (profile.total_likes || 0) + likesToAward })
            .eq("user_id", share.user_id);
        }

        // Mark as awarded
        await supabase
          .from("referral_shares")
          .update({ likes_awarded: true })
          .eq("id", share.id);

        // Create notification
        await supabase.from("notifications").insert({
          user_id: share.user_id,
          tipo: "referral",
          mensagem: `🎉 Alguém clicou seu convite ${share.network}! +${likesToAward} likes!`,
        });
      }
    }

    // Redirect to the app
    return new Response(null, {
      status: 302,
      headers: { Location: "https://playlike.lovable.app", ...corsHeaders },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(null, {
      status: 302,
      headers: { Location: "https://playlike.lovable.app", ...corsHeaders },
    });
  }
});
