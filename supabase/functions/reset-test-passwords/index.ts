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

  const testEmails = [
    "teste1@playlike.com",
    "teste2@playlike.com",
    "juiz@playlike.com",
    "aplanejamento@gmail.com",
  ];
  const newPassword = "teste123";
  const results: string[] = [];

  const allUsers: any[] = [];
  let page = 1;
  while (true) {
    const { data: { users: batch } } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (!batch || batch.length === 0) break;
    allUsers.push(...batch);
    if (batch.length < 1000) break;
    page++;
  }
  const users = allUsers;

  // Debug: list all user emails
  const allEmails = users.map((u: any) => u.email);
  
  for (const email of testEmails) {
    const user = users?.find((u: any) => u.email === email);
    if (!user) {
      results.push(`❌ ${email}: usuário não encontrado (total users: ${users.length})`);
      continue;
    }
    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password: newPassword });
    if (error) {
      results.push(`❌ ${email}: ${error.message}`);
    } else {
      results.push(`✅ ${email}: senha resetada para ${newPassword}`);
    }
  }

  return new Response(JSON.stringify({ results, allEmails }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
