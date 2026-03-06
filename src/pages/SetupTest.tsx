import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const SetupTest = () => {
  const [result, setResult] = useState<string[]>(["Iniciando setup..."]);
  const [loginResult, setLoginResult] = useState<string>("");
  const [step, setStep] = useState<"setup" | "ready" | "error">("setup");

  const addLog = (msg: string) => setResult(prev => [...prev, msg]);

  useEffect(() => {
    const setup = async () => {
      // Step 1: Call migrate-duels edge function (creates users + checks schema)
      addLog("📦 Chamando migrate-duels...");
      try {
        const { data, error } = await supabase.functions.invoke("migrate-duels");
        if (error) {
          addLog("⚠️ migrate-duels: " + error.message);
        } else if (data?.results) {
          for (const r of data.results) addLog("   " + r);
        }
      } catch (e: any) {
        addLog("⚠️ migrate-duels catch: " + e.message);
      }

      // Step 2: Also try create-test-users as fallback
      addLog("📦 Chamando create-test-users...");
      try {
        const { data, error } = await supabase.functions.invoke("create-test-users");
        if (error) {
          addLog("⚠️ create-test-users: " + error.message);
        } else if (data?.results) {
          for (const r of data.results) addLog("   " + r);
        }
      } catch (e: any) {
        addLog("⚠️ create-test-users catch: " + e.message);
      }

      // Step 3: Verify schema by trying selects
      addLog("--- Verificando schema ---");
      
      const { error: stakeErr } = await supabase.from("duels").select("stake_amount").limit(1);
      addLog(stakeErr ? "❌ stake_amount: " + stakeErr.message : "✅ stake_amount OK");

      const { error: typeErr } = await supabase.from("duels").select("duel_type").limit(1);
      addLog(typeErr ? "❌ duel_type: " + typeErr.message : "✅ duel_type OK");

      const { error: cvErr } = await supabase.from("duels").select("challenger_votes").limit(1);
      addLog(cvErr ? "❌ challenger_votes: " + cvErr.message : "✅ challenger_votes OK");

      const { error: dvErr } = await supabase.from("duel_votes").select("id").limit(1);
      addLog(dvErr ? "❌ duel_votes: " + dvErr.message : "✅ duel_votes OK");

      // Step 4: Test login for each user
      addLog("--- Testando logins ---");
      for (const email of ["teste1@playlike.com", "teste2@playlike.com", "juiz@playlike.com"]) {
        const { error } = await supabase.auth.signInWithPassword({ email, password: "123456" });
        if (error) {
          addLog(`❌ ${email}: ${error.message}`);
        } else {
          addLog(`✅ ${email}: login OK`);
          await supabase.auth.signOut();
        }
        await new Promise(r => setTimeout(r, 500));
      }

      addLog("--- Setup concluído ---");
      setStep("ready");
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
      setLoginResult("✅ Login OK! Redirecionando para /feed...");
      setTimeout(() => { window.location.href = "/feed"; }, 1000);
    }
  };

  const handleLoginDuels = async (email: string) => {
    setLoginResult("Fazendo login " + email + " → /duels...");
    await supabase.auth.signOut();
    const { error } = await supabase.auth.signInWithPassword({ email, password: "123456" });
    if (error) {
      setLoginResult("❌ " + error.message);
    } else {
      setLoginResult("✅ Login OK! Redirecionando para /duels...");
      setTimeout(() => { window.location.href = "/duels"; }, 1000);
    }
  };

  return (
    <div className="p-8 bg-background text-foreground min-h-screen">
      <h1 className="text-2xl font-bold mb-4">🔧 Setup & Teste PlayLike</h1>
      
      <div className="bg-muted p-4 rounded mb-4 text-xs space-y-1 max-h-96 overflow-auto font-mono">
        {result.map((r, i) => <div key={i}>{r}</div>)}
      </div>

      <h2 className="text-lg font-bold mb-2">🎮 Login Rápido → Feed</h2>
      <div className="flex gap-4 flex-wrap mb-4">
        <button onClick={() => handleLogin("teste1@playlike.com")} className="px-4 py-2 bg-primary text-primary-foreground rounded font-bold">
          Jogador 1 → Feed
        </button>
        <button onClick={() => handleLogin("teste2@playlike.com")} className="px-4 py-2 bg-primary text-primary-foreground rounded font-bold">
          Jogador 2 → Feed
        </button>
        <button onClick={() => handleLogin("juiz@playlike.com")} className="px-4 py-2 bg-primary text-primary-foreground rounded font-bold">
          Juiz → Feed
        </button>
      </div>

      <h2 className="text-lg font-bold mb-2">⚔️ Login Rápido → Duelos</h2>
      <div className="flex gap-4 flex-wrap mb-4">
        <button onClick={() => handleLoginDuels("teste1@playlike.com")} className="px-4 py-2 bg-destructive text-destructive-foreground rounded font-bold">
          Jogador 1 → Duelos
        </button>
        <button onClick={() => handleLoginDuels("teste2@playlike.com")} className="px-4 py-2 bg-destructive text-destructive-foreground rounded font-bold">
          Jogador 2 → Duelos
        </button>
      </div>

      {loginResult && <p className="mt-4 text-sm font-mono">{loginResult}</p>}

      <div className="mt-8 text-xs text-muted-foreground">
        <p>⚠️ Se os logins falharem com "Email not confirmed", execute no SQL Editor do Supabase:</p>
        <code className="block bg-muted p-2 rounded mt-1">
          UPDATE auth.users SET email_confirmed_at = NOW() WHERE email IN ('teste1@playlike.com','teste2@playlike.com','juiz@playlike.com');
        </code>
        <p className="mt-2">⚠️ Se colunas duels faltarem, execute:</p>
        <code className="block bg-muted p-2 rounded mt-1">
          ALTER TABLE duels ADD COLUMN IF NOT EXISTS stake_amount integer DEFAULT 100;<br/>
          ALTER TABLE duels ADD COLUMN IF NOT EXISTS duel_type text DEFAULT 'normal';<br/>
          ALTER TABLE duels ADD COLUMN IF NOT EXISTS challenger_votes integer DEFAULT 0;<br/>
          ALTER TABLE duels ADD COLUMN IF NOT EXISTS challenged_votes integer DEFAULT 0;
        </code>
      </div>
    </div>
  );
};

export default SetupTest;
