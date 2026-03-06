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

  const results: string[] = [];

  // Migration: Add columns to duels table using individual queries
  const columns = [
    { name: "stake_amount", type: "integer", default: "100" },
    { name: "duel_type", type: "text", default: "'normal'" },
    { name: "challenger_votes", type: "integer", default: "0" },
    { name: "challenged_votes", type: "integer", default: "0" },
  ];

  for (const col of columns) {
    // Check if column exists by trying to select it
    const { error } = await supabaseAdmin.from("duels").select(col.name).limit(1);
    if (error && error.message.includes(col.name)) {
      results.push(`⚠️ Column ${col.name} missing - needs manual SQL ALTER TABLE`);
    } else {
      results.push(`✅ Column ${col.name} exists or accessible`);
    }
  }

  // Check duel_votes table
  const { error: dvErr } = await supabaseAdmin.from("duel_votes").select("id").limit(1);
  if (dvErr) {
    results.push(`⚠️ duel_votes table: ${dvErr.message}`);
  } else {
    results.push("✅ duel_votes table exists");
  }

  // Create test users
  const testUsers = [
    { email: "teste1@playlike.com", password: "123456", name: "Jogador Teste 1", user_type: "jogador", total_likes: 1000, sex: "M", whatsapp: "11999999901", birth_date: "2000-01-01" },
    { email: "teste2@playlike.com", password: "123456", name: "Jogador Teste 2", user_type: "jogador", total_likes: 800, sex: "F", whatsapp: "11999999902", birth_date: "2000-02-02" },
    { email: "juiz@playlike.com", password: "123456", name: "Juiz Teste", user_type: "juiz", total_likes: 500, sex: "M", whatsapp: "11999999903", birth_date: "1995-05-05" },
  ];

  for (const u of testUsers) {
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = users?.find((eu: any) => eu.email === u.email);

    if (existing) {
      await supabaseAdmin.from("profiles").upsert({
        user_id: existing.id, name: u.name, user_type: u.user_type,
        total_likes: u.total_likes, sex: u.sex, whatsapp: u.whatsapp, birth_date: u.birth_date,
      }, { onConflict: "user_id" });
      results.push(`✅ ${u.email} exists - profile updated`);
    } else {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: u.email, password: u.password, email_confirm: true,
        user_metadata: { name: u.name },
      });
      if (error) {
        results.push(`❌ ${u.email}: ${error.message}`);
      } else {
        await supabaseAdmin.from("profiles").upsert({
          user_id: data.user.id, name: u.name, user_type: u.user_type,
          total_likes: u.total_likes, sex: u.sex, whatsapp: u.whatsapp, birth_date: u.birth_date,
        }, { onConflict: "user_id" });
        results.push(`✅ ${u.email} created`);
      }
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
