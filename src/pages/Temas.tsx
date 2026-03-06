import { useTemas } from "@/hooks/useTemas";
import AppHeader from "@/components/AppHeader";
import GlobalNav from "@/components/GlobalNav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Loader2, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Temas = () => {
  const { temas, isLoading } = useTemas();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <GlobalNav />
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="text-center space-y-2">
          <h1 className="font-cinzel text-2xl text-primary flex items-center justify-center gap-2">
            <Sparkles className="w-6 h-6" /> Temas Multiplicadores
          </h1>
          <p className="text-muted-foreground text-sm">
            Escolha um tema para ganhar um multiplicador de likes! Poste conteúdo condizente com o tema.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : temas.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">Nenhum tema ativo no momento.</p>
        ) : (
          <div className="grid gap-3">
            {temas.map((tema) => (
              <Card key={tema.id} className="overflow-hidden border-border bg-card">
                <div className="flex items-center gap-4 p-4">
                  {tema.midia_url && (
                    <img
                      src={tema.midia_url}
                      alt={tema.titulo}
                      className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-cinzel text-lg text-foreground truncate">{tema.titulo}</h3>
                    <p className="text-primary font-bold text-sm">
                      Multiplicador: {tema.fator}x
                    </p>
                  </div>
                  <Button
                    onClick={() => navigate(`/editor?tema=${tema.id}`)}
                    className="bg-primary hover:bg-primary/90 flex-shrink-0"
                  >
                    <ArrowRight className="w-4 h-4 mr-1" />
                    Postar
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Temas;
