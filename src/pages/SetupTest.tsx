import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const SetupTest = () => {
  const [result, setResult] = useState<string[]>(["Iniciando setup..."]);
  const [loginResult, setLoginResult] = useState<string>("");

  const addLog = (msg: string) => setResult(prev => [...prev, msg]);

  useEffect(() => {
    const setup = async () => {
      // Call edge function to create users + schema
      addLog("Chamando edge function create-test-users...");
      try {
        const { data, error } = await supabase.functions.invoke("create-test-users");
        if (error) {
          addLog("❌ Edge function erro: " + error.message);
          addLog("Tentando signup manual...");
          await manualSetup();
        } else {
          addLog("✅ Edge function OK:");
          if (data?.results) {
            for (const r of data.results) {
              addLog("   " + r);
            }
          } else {
            addLog(JSON.stringify(data));
          }
        }
      } catch (e: any) {
        addLog("❌ Erro: " + e.message);
        addLog("Tentando signup manual...");
        await manualSetup();
      }

      // Verify schema
      addLog("--- Verificando schema ---");
      const { error: colErr } = await supabase.from("duels").select("stake_amount").limit(1);
      addLog(colErr ? "⚠️ stake_amount: " + colErr.message : "✅ stake_amount OK");

      const { error: dvErr } = await supabase.from("duel_votes").select("id").limit(1);
      addLog(dvErr ? "⚠️ duel_votes: " + dvErr.message : "✅ duel_votes OK");

      addLog("--- Setup concluído ---");
    };

    const manualSetup = async () => {
      const users = [
        { email: "teste1@playlike.com", name: "Jogador Teste 1", user_type: "jogador", sex: "M", whatsapp: "11999999901", birth_date: "2000-01-01" },
        { email: "teste2@playlike.com", name: "Jogador Teste 2", user_type: "jogador", sex: "F", whatsapp: "11999999902", birth_date: "2000-02-02" },
        { email: "juiz@playlike.com", name: "Juiz Teste", user_type: "juiz", sex: "M", whatsapp: "11999999903", birth_date: "1995-05-05" },
      ];

      for (const u of users) {
        // Try login first
        const { error: loginErr } = await supabase.auth.signInWithPassword({ email: u.email, password: "123456" });
        if (!loginErr) {
          addLog(`✅ ${u.email} já existe`);
          await supabase.auth.signOut();
          continue;
        }

        // Signup
        const { data, error } = await supabase.auth.signUp({
          email: u.email,
          password: "123456",
          options: { data: { name: u.name, user_type: u.user_type, sex: u.sex, whatsapp: u.whatsapp, birth_date: u.birth_date } },
        });
        if (error) {
          addLog(`❌ ${u.email}: ${error.message}`);
        } else {
          addLog(`✅ ${u.email} criado`);
          await supabase.auth.signOut();
        }
        // Wait to avoid rate limiting
        await new Promise(r => setTimeout(r, 2000));
      }
    };

    setup();
  }, []);

  const handleLogin = async (email: string) => {
    setLoginResult("Fazendo login " + email + "...");
    await supabase.auth.signOut();
    const { error } = await supabase.auth.signInWithPassword({ email, password: "123456" });
    if (error) {
      setLoginResult("❌ " + error.message);
    } else {
      setLoginResult("✅ Login OK! Redirecionando...");
      setTimeout(() => { window.location.href = "/feed"; }, 1000);
    }
  };

  return (
    <div className="p-8 bg-background text-foreground min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Setup Teste PlayLike</h1>
      <div className="bg-muted p-4 rounded mb-4 text-xs space-y-1 max-h-96 overflow-auto font-mono">
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
