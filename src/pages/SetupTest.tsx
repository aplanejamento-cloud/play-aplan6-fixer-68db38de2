import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const SetupTest = () => {
  const [result, setResult] = useState<string>("Carregando...");
  const [loginResult, setLoginResult] = useState<string>("");

  useEffect(() => {
    const run = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("create-test-users");
        if (error) {
          setResult("Erro: " + error.message);
        } else {
          setResult(JSON.stringify(data, null, 2));
        }
      } catch (e: any) {
        setResult("Erro: " + e.message);
      }
    };
    run();
  }, []);

  const handleLogin = async (email: string) => {
    setLoginResult("Fazendo login...");
    const { error } = await supabase.auth.signInWithPassword({ email, password: "123456" });
    if (error) {
      setLoginResult("Erro login: " + error.message);
    } else {
      setLoginResult("Login OK! Redirecionando...");
      window.location.href = "/feed";
    }
  };

  return (
    <div className="p-8 bg-background text-foreground min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Setup Teste</h1>
      <pre className="bg-muted p-4 rounded mb-4 text-xs overflow-auto max-h-96">{result}</pre>
      <div className="flex gap-4">
        <button onClick={() => handleLogin("teste1@playlike.com")} className="px-4 py-2 bg-primary text-primary-foreground rounded">Login Jogador 1</button>
        <button onClick={() => handleLogin("teste2@playlike.com")} className="px-4 py-2 bg-primary text-primary-foreground rounded">Login Jogador 2</button>
        <button onClick={() => handleLogin("juiz@playlike.com")} className="px-4 py-2 bg-primary text-primary-foreground rounded">Login Juiz</button>
      </div>
      {loginResult && <p className="mt-4 text-sm">{loginResult}</p>}
    </div>
  );
};

export default SetupTest;
