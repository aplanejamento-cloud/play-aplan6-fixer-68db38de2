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
  ];
  const newPassword = "teste123";
  const results: string[] = [];

  const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });

  for (const email of testEmails) {
    const user = users?.find((u: any) => u.email === email);
    if (!user) {
      results.push(`❌ ${email}: usuário não encontrado`);
      continue;
    }
    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password: newPassword });
    if (error) {
      results.push(`❌ ${email}: ${error.message}`);
    } else {
      results.push(`✅ ${email}: senha resetada para ${newPassword}`);
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
