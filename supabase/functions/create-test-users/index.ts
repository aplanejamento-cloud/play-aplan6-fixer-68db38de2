import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Step 1: Ensure schema columns exist via rpc or direct table operations
  // We'll check if duel_votes table exists by trying to select from it
  const schemaResults: string[] = [];

  // Try adding columns to duels (will silently fail if they exist)
  for (const col of ["stake_amount", "duel_type", "challenger_votes", "challenged_votes"]) {
    const { error } = await supabaseAdmin.from("duels").select(col).limit(1);
    if (error) {
      schemaResults.push(`Column ${col} missing - needs migration`);
    } else {
      schemaResults.push(`Column ${col} OK`);
    }
  }

  // Check duel_votes table
  const { error: dvError } = await supabaseAdmin.from("duel_votes").select("id").limit(1);
  if (dvError) {
    schemaResults.push("duel_votes table missing - needs migration");
  } else {
    schemaResults.push("duel_votes table OK");
  }

  // Step 2: Create test users
  const testUsers = [
    { email: "teste1@playlike.com", password: "123456", name: "Jogador Teste 1", user_type: "jogador", total_likes: 1000, sex: "M", whatsapp: "11999999901", birth_date: "2000-01-01" },
    { email: "teste2@playlike.com", password: "123456", name: "Jogador Teste 2", user_type: "jogador", total_likes: 800, sex: "F", whatsapp: "11999999902", birth_date: "2000-02-02" },
    { email: "juiz@playlike.com", password: "123456", name: "Juiz Teste", user_type: "juiz", total_likes: 500, sex: "M", whatsapp: "11999999903", birth_date: "1995-05-05" },
  ];

  const userResults = [];

  for (const u of testUsers) {
    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existing = existingUsers?.users?.find((eu: any) => eu.email === u.email);

    let userId: string;

    if (existing) {
      userId = existing.id;
      userResults.push({ email: u.email, status: "already_exists", id: userId });
    } else {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { name: u.name },
      });

      if (authError) {
        userResults.push({ email: u.email, status: "auth_error", error: authError.message });
        continue;
      }

      userId = authData.user.id;
      userResults.push({ email: u.email, status: "created", id: userId });
    }

    // Upsert profile
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      user_id: userId,
      name: u.name,
      user_type: u.user_type,
      total_likes: u.total_likes,
      sex: u.sex,
      whatsapp: u.whatsapp,
      birth_date: u.birth_date,
    }, { onConflict: "user_id" });

    if (profileError) {
      userResults.push({ email: u.email, status: "profile_error", error: profileError.message });
    }
  }

  return new Response(JSON.stringify({ schema: schemaResults, users: userResults }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
