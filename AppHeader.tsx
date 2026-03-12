import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, Heart, Crown, User, UserPlus } from "lucide-react";
import GlobalNav from "./GlobalNav";
import NotificationsDropdown from "./NotificationsDropdown";
import LoginButton from "./home/LoginButton";

const AppHeader = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return (
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="font-cinzel text-xl text-primary glow-gold-subtle shrink-0">
            PLAYLIKE
          </button>
          <div className="flex items-center gap-2">
            <LoginButton 
              triggerVariant="ghost"
              triggerClassName="text-primary hover:bg-primary/10 font-bold"
              triggerText="ENTRAR"
            />
            <Button 
              onClick={() => {
                const signup = document.getElementById("signup-section");
                if (signup) {
                  signup.scrollIntoView({ behavior: "smooth" });
                } else {
                  navigate("/");
                }
              }} 
              variant="default" 
              className="bg-primary text-primary-foreground font-bold"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              CRIAR CONTA
            </Button>
          </div>
        </div>
        <div className="container mx-auto px-4 pb-1.5 overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
          <GlobalNav />
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-4 py-2 flex items-center justify-between gap-2">
        <button onClick={() => navigate("/")} className="font-cinzel text-lg text-primary glow-gold-subtle shrink-0">
          PLAYLIKE
        </button>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 text-xs">
            <Heart className="w-3.5 h-3.5 fill-primary text-primary" />
            <span className="font-bold text-primary">{profile?.total_likes?.toLocaleString("pt-BR")}</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            {profile?.user_type === "jogador" ? (
              <Crown className="w-3.5 h-3.5 text-primary" />
            ) : (
              <User className="w-3.5 h-3.5 text-accent" />
            )}
          </div>
          <NotificationsDropdown />
          <Button variant="ghost" size="sm" onClick={signOut} className="h-7 px-2 text-muted-foreground hover:text-primary">
            <LogOut className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      {/* Nav on second line, always visible with scroll */}
      <div className="container mx-auto px-4 pb-1.5 overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
        <GlobalNav />
      </div>
    </header>
  );
};

export default AppHeader;
