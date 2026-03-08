import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Unsplash photo collections for bot posts (landscape/lifestyle/nature)
const POST_IMAGES = [
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1518173946687-a7c2a6b79e1e?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1500534314263-0869cdddb169?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1504567961542-e24d9439a724?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1465056836900-8f1e940f1a8b?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1532274402911-5a369e4c4bb5?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1541959833400-049d37f98ccd?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1494783367193-149034c05e8f?w=800&h=600&fit=crop",
];

const CAPTIONS = [
  "Curtindo o momento! ✨🔥",
  "Quem mais tá nessa vibe? 💪😎",
  "Isso sim é vida! 🌟🎉",
  "Mais um dia abençoado 🙏💖",
  "Vibes positivas sempre! 🌈✨",
  "Gratidão por tudo! ❤️🙌",
  "Sem filtro, só verdade! 📸💯",
  "Essa foto ficou demais! 🔥👑",
  "Bora fazer acontecer! 🚀💪",
  "A vida é curta, sorria! 😁💫",
  "Momento perfeito! 🎯✨",
  "Cada dia uma nova aventura! 🌍🏆",
  "Quem curte dá like! ❤️👏",
  "Sonhe grande, trabalhe duro! 💎🔥",
  "Dia lindo pra compartilhar! ☀️🌟",
  "Energia boa é tudo! ⚡🎶",
  "Nada como um dia após o outro! 🌅💖",
  "Focado nos objetivos! 🎯🚀",
  "Aproveitando cada segundo! ⏰✨",
  "Natureza incrível! 🌿🦋",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get all bot profiles
    const { data: bots, error: botsError } = await supabase
      .from("profiles")
      .select("user_id, name")
      .eq("is_bot", true);

    if (botsError || !bots || bots.length === 0) {
      return new Response(
        JSON.stringify({ error: "No bots found", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let count = 0;

    for (const bot of bots) {
      // Pick random image and caption
      const imageUrl = POST_IMAGES[Math.floor(Math.random() * POST_IMAGES.length)];
      const caption = CAPTIONS[Math.floor(Math.random() * CAPTIONS.length)];

      const { error: postError } = await supabase.from("posts").insert({
        user_id: bot.user_id,
        content: caption,
        image_url: imageUrl,
        tipo: "normal",
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      if (!postError) count++;
    }

    return new Response(
      JSON.stringify({ success: true, count, bots: bots.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
