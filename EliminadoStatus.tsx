import { ThumbsDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import AppHeader from "@/components/AppHeader";
import InviteButton from "@/components/InviteButton";
import { useAuth } from "@/contexts/AuthContext";

const EliminadoStatus = () => {
  const { profile } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <InviteButton />
      <main className="container mx-auto px-4 py-12 max-w-lg text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-24 h-24 rounded-full bg-destructive/10 flex items-center justify-center border-2 border-destructive/30 animate-pulse">
            <ThumbsDown className="w-12 h-12 text-destructive" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="font-cinzel text-3xl text-foreground">Você foi <span className="text-destructive">ELIMINADO</span></h1>
          <p className="text-muted-foreground">
            Sua jornada no PlayLike foi interrompida temporariamente por falta de likes.
          </p>
        </div>

        <Card className="border-destructive/20 bg-destructive/5 shadow-lg shadow-destructive/10">
          <CardContent className="p-6 space-y-4">
            <p className="text-sm font-medium text-foreground">
              Para retornar ao jogo e recuperar seu perfil:
            </p>
            <div className="text-3xl font-bold text-primary animate-bounce">
              Ganhe 100 likes
            </div>
            <p className="text-xs text-muted-foreground">
              Seu saldo atual: <span className="text-destructive font-bold">{profile?.total_likes || 0}</span> likes.
              <br />Convide amigos ou peça likes em suas redes sociais usando seu link de convite.
            </p>
          </CardContent>
        </Card>

        <div className="p-4 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground">
          💡 Dica: Cada novo amigo que entrar pelo seu link te dá likes extras!
        </div>
      </main>
    </div>
  );
};

export default EliminadoStatus;
