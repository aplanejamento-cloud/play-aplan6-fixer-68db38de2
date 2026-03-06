import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const SetupTest = () => {
  const [result, setResult] = useState<string[]>([]);
  const [loginResult, setLoginResult] = useState<string>("");

  const addLog = (msg: string) => setResult(prev => [...prev, msg]);

  useEffect(() => {
    const setup = async () => {
      // First check schema
      addLog("Verificando schema duels...");
      
      const { data: duelCols, error: colErr } = await supabase.from("duels").select("stake_amount,duel_type,challenger_votes,challenged_votes").limit(1);
      if (colErr) {
        addLog("⚠️ Colunas duels faltando: " + colErr.message);
      } else {
        addLog("✅ Colunas duels OK (stake_amount, duel_type, challenger_votes, challenged_votes)");
      }

      const { error: dvErr } = await supabase.from("duel_votes").select("id").limit(1);
      if (dvErr) {
        addLog("⚠️ Tabela duel_votes: " + dvErr.message);
      } else {
        addLog("✅ Tabela duel_votes OK");
      }

      // Try to create test users via signUp
      const testUsers = [
        { email: "teste1@playlike.com", password: "123456", name: "Jogador Teste 1", user_type: "jogador" as const, sex: "M", whatsapp: "11999999901", birth_date: "2000-01-01" },
        { email: "teste2@playlike.com", password: "123456", name: "Jogador Teste 2", user_type: "jogador" as const, sex: "F", whatsapp: "11999999902", birth_date: "2000-02-02" },
        { email: "juiz@playlike.com", password: "123456", name: "Juiz Teste", user_type: "juiz" as const, sex: "M", whatsapp: "11999999903", birth_date: "1995-05-05" },
      ];

      for (const u of testUsers) {
        addLog(`Criando ${u.email}...`);
        
        // Try login first (user may already exist)
        const { error: loginErr } = await supabase.auth.signInWithPassword({ email: u.email, password: u.password });
        if (!loginErr) {
          addLog(`✅ ${u.email} já existe - login OK`);
          await supabase.auth.signOut();
          continue;
        }

        // Try signup
        const { data, error } = await supabase.auth.signUp({
          email: u.email,
          password: u.password,
          options: {
            data: { name: u.name, user_type: u.user_type, sex: u.sex, whatsapp: u.whatsapp, birth_date: u.birth_date },
          },
        });

        if (error) {
          addLog(`❌ ${u.email}: ${error.message}`);
        } else if (data.user) {
          addLog(`✅ ${u.email} criado (id: ${data.user.id.slice(0,8)}...)`);
          
          // Update profile with correct likes
          const likes = u.user_type === "juiz" ? 500 : u.email.includes("teste1") ? 1000 : 800;
          await supabase.from("profiles").update({ total_likes: likes }).eq("user_id", data.user.id);
          addLog(`   → total_likes: ${likes}`);
          
          await supabase.auth.signOut();
        }
      }

      addLog("--- Setup concluído ---");
    };

    setup();
  }, []);

  const handleLogin = async (email: string) => {
    setLoginResult("Fazendo login " + email + "...");
    await supabase.auth.signOut();
    const { error } = await supabase.auth.signInWithPassword({ email, password: "123456" });
    if (error) {
      setLoginResult("❌ Erro login: " + error.message);
    } else {
      setLoginResult("✅ Login OK! Redirecionando...");
      setTimeout(() => { window.location.href = "/feed"; }, 1000);
    }
  };

  return (
    <div className="p-8 bg-background text-foreground min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Setup Teste PlayLike</h1>
      <div className="bg-muted p-4 rounded mb-4 text-xs space-y-1 max-h-96 overflow-auto">
        {result.map((r, i) => <div key={i}>{r}</div>)}
      </div>
      <div className="flex gap-4 flex-wrap">
        <button onClick={() => handleLogin("teste1@playlike.com")} className="px-4 py-2 bg-primary text-primary-foreground rounded font-bold">Login Jogador 1</button>
        <button onClick={() => handleLogin("teste2@playlike.com")} className="px-4 py-2 bg-primary text-primary-foreground rounded font-bold">Login Jogador 2</button>
        <button onClick={() => handleLogin("juiz@playlike.com")} className="px-4 py-2 bg-primary text-primary-foreground rounded font-bold">Login Juiz</button>
      </div>
      {loginResult && <p className="mt-4 text-sm font-mono">{loginResult}</p>}
    </div>
  );
};

export default SetupTest;
