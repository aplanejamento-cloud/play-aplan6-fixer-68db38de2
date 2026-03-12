import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";
import { Home, User, Flame, Swords, Trophy, Gift, MessageSquare, BookOpen, HelpCircle, DollarSign, Download, Gavel, Paintbrush, Crown, BarChart3, Bot, Star, Skull, LifeBuoy, Sparkles, FileText, Ticket, PieChart, Heart, HandHeart, ThumbsDown } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useGameState } from "@/hooks/useGameState";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

const loggedOutItems = [
  { path: "/", label: "Home", icon: Home },
  { path: "/patrocinador", label: "Patrocínio", icon: Crown },
  { path: "/eliminados", label: "Eliminados", icon: ThumbsDown },
];

const GlobalNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();
  const { gameState } = useGameState();
  const { isAdmin } = useIsAdmin();
  const gameOn = gameState?.game_on ?? false;
  const navRef = useRef<HTMLDivElement>(null);

  // Pending counts for admin badges
  const { data: pendingResgates = 0 } = useQuery({
    queryKey: ["pending-resgates-count"],
    enabled: !!user && isAdmin,
    refetchInterval: 15000,
    queryFn: async () => {
      const { count } = await (supabase.from("resgates").select("*", { count: "exact", head: true }) as any).eq("status", "pendente");
      return count || 0;
    },
  });

  const { data: pendingDoacoes = 0 } = useQuery({
    queryKey: ["pending-doacoes-count"],
    enabled: !!user && isAdmin,
    refetchInterval: 15000,
    queryFn: async () => {
      const { count } = await (supabase.from("doacoes_premios").select("*", { count: "exact", head: true }) as any).eq("aprovado", false);
      return count || 0;
    },
  });

  const totalLikes = profile?.total_likes ?? 9999;

  const allItems = [
    { path: "/", label: "Home", icon: Home, requiresGame: false, requiresAuth: false },
    { path: "/comprar-likes", label: "💰 Carregar Likes", icon: DollarSign, requiresGame: true, requiresAuth: true, lowLikes: true },
    { path: "/doacoes", label: "Doações", icon: Gift, requiresGame: true, requiresAuth: true },
    { path: "/patrocinador", label: "Patrocínio", icon: Crown, requiresGame: false, requiresAuth: false },
    { path: "/profile", label: "Perfil", icon: User, requiresGame: false, requiresAuth: true },
    { path: "/feed", label: "Feed", icon: Flame, requiresGame: true, requiresAuth: true },
    { path: "/duels", label: "Duelos", icon: Swords, requiresGame: true, requiresAuth: true },
    { path: "/top10", label: "Top10", icon: Trophy, requiresGame: true, requiresAuth: true },
    { path: "/desafios", label: "Desafios", icon: Gavel, requiresGame: true, requiresAuth: true },
    { path: "/comprar-likes", label: "Carregar Likes", icon: Heart, requiresGame: true, requiresAuth: true },
    { path: "/premios", label: "Prêmios", icon: Gift, requiresGame: true, requiresAuth: true },
    { path: "/doacoes", label: "Doações", icon: HandHeart, requiresGame: true, requiresAuth: true },
    { path: "/chats", label: "Chats", icon: MessageSquare, requiresGame: true, requiresAuth: true },
    { path: "/eliminados", label: "Eliminados", icon: ThumbsDown, requiresGame: false, requiresAuth: false },
    { path: "/ajuda", label: "Ajuda", icon: LifeBuoy, requiresGame: false, requiresAuth: true },
    { path: "/patrocinador", label: "Patrocínio", icon: Crown, requiresGame: false, requiresAuth: false },
    { path: "/stats", label: "Stats", icon: BarChart3, requiresGame: false, requiresAuth: true, requiresAdmin: true },
    { path: "/admin/resgates", label: "Resgates", icon: Ticket, requiresGame: false, requiresAuth: true, requiresAdmin: true },
    { path: "/bots-control", label: "Bots", icon: Bot, requiresGame: false, requiresAuth: true, requiresAdmin: true },
  ];

  const visibleItems = !user
    ? loggedOutItems
    : allItems.filter((item) => {
        if (item.requiresGame && !gameOn) return false;
        if ((item as any).requiresAdmin && !isAdmin) return false;
        return true;
      });

  useEffect(() => {
    if (!navRef.current) return;
    const activeBtn = navRef.current.querySelector('[data-active="true"]');
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [location.pathname]);

  return (
    <nav ref={navRef} className="flex items-center gap-1 overflow-x-auto scrollbar-thin pb-0.5" style={{ scrollbarWidth: 'thin' }}>
      {visibleItems.map((item) => {
        const isActive = location.pathname === item.path;
        const badgeCount =
          item.path === "/admin/resgates" ? pendingResgates :
          item.path === "/doacoes" && isAdmin ? pendingDoacoes : 0;
        const showLowLikes = (item as any).lowLikes && totalLikes < 500;
        return (
          <button
            key={item.path}
            data-active={isActive}
            onClick={() => navigate(item.path)}
            className={cn(
              "relative flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors min-h-[56px]",
              isActive
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:text-primary hover:bg-primary/10"
            )}
          >
            <item.icon className="w-4 h-4" />
            <span>{item.label}</span>
            {badgeCount > 0 && (
              <Badge className="bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0 min-w-[18px] h-[18px] flex items-center justify-center rounded-full">
                {badgeCount}
              </Badge>
            )}
            {showLowLikes && (
              <Badge className="bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0 min-w-[18px] h-[18px] flex items-center justify-center rounded-full">
                !
              </Badge>
            )}
          </button>
        );
      })}
    </nav>
  );
};

export default GlobalNav;
