import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDuels, Duel } from "@/hooks/useDuels";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Swords, Heart, Gem, Clock,
  CheckCircle, XCircle, Crown, Skull, Timer, Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AppHeader from "@/components/AppHeader";
import InviteButton from "@/components/InviteButton";
import { toast } from "sonner";
import ChallengeDialog from "@/components/feed/ChallengeDialog";
import { differenceInDays, addDays } from "date-fns";
import { cn } from "@/lib/utils";

const Duels = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { duels, pendingDuels, isLoading, challengeUser, acceptDuel, refuseDuel, voteDuel, resolveDuel } = useDuels();
  const [searchName, setSearchName] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [showChallengeDialog, setShowChallengeDialog] = useState(false);
  const [feedTab, setFeedTab] = useState<"ativos" | "finalizados">("ativos");
  const [feedSearch, setFeedSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isJuiz = profile?.user_type === "juiz";

  // User already in active duel?
  const userInActiveDuel = duels.some(
    (d) =>
      (d.challenger_id === user?.id || d.challenged_id === user?.id) &&
      (d.status === "pending" || d.status === "active")
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Auto-resolve expired duels (7+ days)
  useEffect(() => {
    duels
      .filter((d) => d.status === "active" && getDaysRemaining(d) <= 0)
      .forEach((d) => resolveDuel(d.id));
  }, [duels]);

  useEffect(() => {
    if (searchName.length < 2) { setSearchResults([]); setShowDropdown(false); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from("profiles")
        .select("user_id, name, avatar_url, total_likes, user_type")
        .ilike("name", `%${searchName}%`)
        .neq("user_id", user?.id || "")
        .eq("user_type", "jogador")
        .eq("is_bot", false)
        .order("total_likes", { ascending: false })
        .limit(10);
      setSearchResults(data || []);
      setShowDropdown((data || []).length > 0);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchName, user?.id]);

  const handleSelectPlayer = (p: any) => {
    setSelectedPlayer(p);
    setSearchName(p.name);
    setShowDropdown(false);
  };

  const handleOpenChallenge = () => {
    if (!selectedPlayer) return;
    if (isJuiz) { toast.error("Juízes não podem desafiar!"); return; }
    if (userInActiveDuel) { toast.error("Você já tem um duelo ativo! Finalize antes."); return; }
    setShowChallengeDialog(true);
  };

  const handleChallengeConfirm = (stakeAmount: number, duelType: "normal" | "fatalite") => {
    if (!selectedPlayer) return;
    challengeUser(selectedPlayer.user_id, stakeAmount, duelType);
    setSelectedPlayer(null);
    setSearchName("");
  };

  const getDaysRemaining = (duel: Duel) => {
    const start = new Date(duel.created_at);
    const end = addDays(start, 7);
    const remaining = differenceInDays(end, new Date());
    return Math.max(0, remaining);
  };

  const getStakeLabel = (duel: Duel) => {
    if (duel.duel_type === "fatalite") return "☠️ FATALITÉ";
    return `${duel.stake_amount || 100} likes`;
  };

  const getStatusBadge = (duel: Duel) => {
    if (duel.status === "refused") return (
      <span className="text-xs bg-destructive/20 text-destructive px-2 py-0.5 rounded-full flex items-center gap-1">
        <Skull className="w-3 h-3" /> ARREGOU
      </span>
    );
    if (duel.status === "completed") return (
      <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
        <Crown className="w-3 h-3" /> FINALIZADO
      </span>
    );
    if (duel.status === "pending") {
      if (user && duel.challenged_id === user.id) {
        return (
          <span className="text-xs bg-accent/20 text-accent-foreground px-2 py-0.5 rounded-full flex items-center gap-1">
            <Clock className="w-3 h-3 animate-pulse" /> Desafio recebido
          </span>
        );
      }
      return (
        <span className="text-xs bg-accent/20 text-accent-foreground px-2 py-0.5 rounded-full flex items-center gap-1">
          <Clock className="w-3 h-3 animate-pulse" /> Aguardando
        </span>
      );
    }
    const days = getDaysRemaining(duel);
    return (
      <span className="text-xs bg-green-500/20 text-green-500 px-2 py-0.5 rounded-full flex items-center gap-1">
        <Swords className="w-3 h-3" /> AO VIVO · {days}d restantes
      </span>
    );
  };

  // Filter duels into sections
  const matchesSearch = (d: Duel) => {
    if (!feedSearch.trim()) return true;
    const q = feedSearch.toLowerCase();
    return (
      d.challenger_profile?.name?.toLowerCase().includes(q) ||
      d.challenged_profile?.name?.toLowerCase().includes(q)
    );
  };

  const duelosAtivos = duels
    .filter((d) => ["pending", "active"].includes(d.status) && matchesSearch(d));

  const duelosFinalizados = duels
    .filter((d) => ["completed", "refused"].includes(d.status) && matchesSearch(d));

  const displayedDuels = feedTab === "ativos" ? duelosAtivos : duelosFinalizados;

  const challengeDisabled = isJuiz || userInActiveDuel;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <InviteButton />
      <main className="container mx-auto px-4 py-6 max-w-2xl space-y-6">
        <div className="text-center space-y-1">
          <h1 className="font-cinzel text-2xl md:text-3xl text-primary glow-gold flex items-center justify-center gap-2">
            <Swords className="w-7 h-7" /> Duelos
          </h1>
          <p className="text-sm text-muted-foreground">Desafie jogadores! Aposte likes ou arrisque tudo no FATALITÉ!</p>
        </div>

        {/* Search & Challenge */}
        <Card className="bg-card/80 border-border">
          <CardContent className="py-4 space-y-3">
            <h3 className="font-cinzel text-sm text-primary">⚔️ Desafiar Jogador</h3>

            {isJuiz && (
              <p className="text-xs text-destructive">⚖️ Juízes não podem criar duelos.</p>
            )}
            {userInActiveDuel && !isJuiz && (
              <p className="text-xs text-destructive">⚠️ Você já tem um duelo ativo. Finalize antes de iniciar outro.</p>
            )}

            <div className="relative" ref={dropdownRef}>
              <div className="flex gap-2">
                <Input
                  placeholder={challengeDisabled ? "Bloqueado" : "Buscar jogador..."}
                  value={searchName}
                  onChange={(e) => { setSearchName(e.target.value); setSelectedPlayer(null); }}
                  className="bg-input border-border"
                  disabled={challengeDisabled}
                />
                <Button
                  onClick={handleOpenChallenge}
                  disabled={!selectedPlayer || challengeDisabled}
                  className="bg-primary text-primary-foreground"
                >
                  <Swords className="w-4 h-4 mr-1" /> Desafiar
                </Button>
              </div>

              {showDropdown && searchResults.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {searchResults.map((p) => (
                    <button
                      key={p.user_id}
                      onClick={() => handleSelectPlayer(p)}
                      className="flex items-center gap-2 w-full p-2.5 hover:bg-muted/60 transition-colors text-left"
                    >
                      <Avatar className="w-9 h-9 border border-border">
                        <AvatarImage src={p.avatar_url || ""} />
                        <AvatarFallback className="bg-secondary text-foreground text-xs">{p.name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Heart className="w-3 h-3" fill="currentColor" />
                          {p.total_likes?.toLocaleString("pt-BR")} likes
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {searching && <p className="text-xs text-muted-foreground mt-1">Buscando...</p>}
            </div>

            {selectedPlayer && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-primary/30">
                <Avatar className="w-10 h-10 border border-primary">
                  <AvatarImage src={selectedPlayer.avatar_url || ""} />
                  <AvatarFallback className="bg-secondary text-foreground">{selectedPlayer.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{selectedPlayer.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedPlayer.total_likes?.toLocaleString("pt-BR")} likes</p>
                </div>
                <Swords className="w-5 h-5 text-primary" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recebidos */}
        {pendingDuels.filter(d => d.challenged_id === user?.id).length > 0 && (
          <Card className="bg-card/80 border-primary/50 border-2">
            <CardContent className="py-4 space-y-3">
              <h3 className="font-cinzel text-sm text-primary animate-pulse-gold">📥 Recebidos</h3>
              {pendingDuels.filter(d => d.challenged_id === user?.id).map((duel) => (
                <div key={duel.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <button
                    className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                    onClick={() => navigate(`/profile/${duel.challenger_id}`)}
                  >
                    <Avatar className="w-10 h-10 border border-primary">
                      <AvatarImage src={duel.challenger_profile?.avatar_url || ""} />
                      <AvatarFallback className="bg-secondary">{duel.challenger_profile?.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="text-left">
                      <p className="text-sm font-medium text-foreground">{duel.challenger_profile?.name}</p>
                      <p className="text-xs text-muted-foreground">Aposta: {getStakeLabel(duel)}</p>
                    </div>
                  </button>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => acceptDuel(duel.id)} className="bg-primary text-primary-foreground">
                      <CheckCircle className="w-4 h-4 mr-1" /> Aceitar
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => refuseDuel(duel)}>
                      <XCircle className="w-4 h-4 mr-1" /> Recusar
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Envios aguardando */}
        {pendingDuels.filter(d => d.challenger_id === user?.id).length > 0 && (
          <Card className="bg-card/80 border-accent/30">
            <CardContent className="py-4 space-y-3">
              <h3 className="font-cinzel text-sm text-accent-foreground">📤 Envios aguardando</h3>
              {pendingDuels.filter(d => d.challenger_id === user?.id).map((duel) => (
                <div key={duel.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <button
                    className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                    onClick={() => navigate(`/profile/${duel.challenged_id}`)}
                  >
                    <Avatar className="w-10 h-10 border border-border">
                      <AvatarImage src={duel.challenged_profile?.avatar_url || ""} />
                      <AvatarFallback className="bg-secondary">{duel.challenged_profile?.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="text-left">
                      <p className="text-sm font-medium text-foreground">{duel.challenged_profile?.name}</p>
                      <p className="text-xs text-muted-foreground">Aposta: {getStakeLabel(duel)} · Aguardando</p>
                    </div>
                  </button>
                  <Button size="sm" variant="outline" className="text-destructive border-destructive/30" onClick={() => refuseDuel(duel)}>
                    <XCircle className="w-4 h-4 mr-1" /> Cancelar
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Tabs + Search for Feed */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFeedTab("ativos")}
              className={cn(
                "flex-1 py-2 text-sm font-cinzel rounded-lg transition-colors text-center",
                feedTab === "ativos"
                  ? "bg-primary/20 text-primary border border-primary/40"
                  : "bg-muted/50 text-muted-foreground border border-border"
              )}
            >
              🟢 Ativos ({duelosAtivos.length})
            </button>
            <button
              onClick={() => setFeedTab("finalizados")}
              className={cn(
                "flex-1 py-2 text-sm font-cinzel rounded-lg transition-colors text-center",
                feedTab === "finalizados"
                  ? "bg-destructive/20 text-destructive border border-destructive/40"
                  : "bg-muted/50 text-muted-foreground border border-border"
              )}
            >
              🔴 Finalizados ({duelosFinalizados.length})
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              value={feedSearch}
              onChange={(e) => setFeedSearch(e.target.value)}
              className="pl-9 bg-input border-border"
            />
          </div>
        </div>

        {/* Duels Feed */}
        <div className="space-y-4">
          {isLoading ? (
            [...Array(3)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)
          ) : displayedDuels.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {feedTab === "ativos"
                ? "Nenhum duelo ativo. Seja o primeiro a desafiar! ⚔️"
                : "Nenhum duelo finalizado ainda."}
            </div>
          ) : (
            displayedDuels.map((duel) => (
              <Card key={duel.id} className="bg-card/80 border-border overflow-hidden">
                <CardContent className="py-4 space-y-3">
                  {/* Status + stake + timer */}
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    {getStatusBadge(duel)}
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${duel.duel_type === "fatalite" ? "bg-destructive/20 text-destructive" : "bg-primary/10 text-primary"}`}>
                        {getStakeLabel(duel)}
                      </span>
                      {duel.status === "active" && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Timer className="w-3 h-3" /> {getDaysRemaining(duel)}d
                        </span>
                      )}
                    </div>
                  </div>

                  {/* VS Layout */}
                  <div className="flex items-center justify-around">
                    <button
                      className="flex flex-col items-center gap-1.5 hover:opacity-80 transition-opacity"
                      onClick={() => navigate(`/profile/${duel.challenger_id}`)}
                    >
                      <Avatar className={`w-16 h-16 border-2 ${duel.winner_id === duel.challenger_id ? "border-primary shadow-gold" : "border-border"}`}>
                        <AvatarImage src={duel.challenger_profile?.avatar_url || ""} />
                        <AvatarFallback className="bg-secondary font-cinzel">{duel.challenger_profile?.name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <p className="text-xs font-medium text-foreground text-center max-w-[80px] truncate">{duel.challenger_profile?.name}</p>
                      <p className="text-lg font-bold text-primary">{duel.challenger_votes.toLocaleString("pt-BR")}</p>
                      {duel.winner_id === duel.challenger_id && <Crown className="w-5 h-5 text-primary animate-float" />}
                    </button>

                    <div className="text-center">
                      <span className="font-cinzel text-2xl text-accent glow-purple">VS</span>
                      {duel.status === "refused" && <p className="text-xs text-destructive mt-1">ARREGOU!</p>}
                      {duel.duel_type === "fatalite" && duel.status === "active" && (
                        <p className="text-[10px] text-destructive mt-1 font-bold">☠️ FATALITÉ</p>
                      )}
                    </div>

                    <button
                      className="flex flex-col items-center gap-1.5 hover:opacity-80 transition-opacity"
                      onClick={() => navigate(`/profile/${duel.challenged_id}`)}
                    >
                      <Avatar className={`w-16 h-16 border-2 ${duel.winner_id === duel.challenged_id ? "border-primary shadow-gold" : "border-border"}`}>
                        <AvatarImage src={duel.challenged_profile?.avatar_url || ""} />
                        <AvatarFallback className="bg-secondary font-cinzel">{duel.challenged_profile?.name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <p className="text-xs font-medium text-foreground text-center max-w-[80px] truncate">{duel.challenged_profile?.name}</p>
                      <p className="text-lg font-bold text-primary">{duel.challenged_votes.toLocaleString("pt-BR")}</p>
                      {duel.winner_id === duel.challenged_id && <Crown className="w-5 h-5 text-primary animate-float" />}
                    </button>
                  </div>

                  {/* Vote Buttons */}
                  {duel.status === "active" && user && duel.challenger_id !== user.id && duel.challenged_id !== user.id && (
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <div className="space-y-1.5">
                        <p className="text-xs text-center text-muted-foreground">Votar em {duel.challenger_profile?.name?.split(" ")[0]}</p>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => voteDuel(duel.id, duel.challenger_id, "play")} className="flex-1 border-accent text-accent text-xs">
                            <Gem className="w-3 h-3 mr-1" /> 1 Play
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => voteDuel(duel.id, duel.challenger_id, "likes")} className="flex-1 border-primary text-primary text-xs">
                            <Heart className="w-3 h-3 mr-1" /> 100
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-xs text-center text-muted-foreground">Votar em {duel.challenged_profile?.name?.split(" ")[0]}</p>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => voteDuel(duel.id, duel.challenged_id, "play")} className="flex-1 border-accent text-accent text-xs">
                            <Gem className="w-3 h-3 mr-1" /> 1 Play
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => voteDuel(duel.id, duel.challenged_id, "likes")} className="flex-1 border-primary text-primary text-xs">
                            <Heart className="w-3 h-3 mr-1" /> 100
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>

      {/* Challenge Dialog */}
      {showChallengeDialog && selectedPlayer && (
        <ChallengeDialog
          open={showChallengeDialog}
          onOpenChange={setShowChallengeDialog}
          targetName={selectedPlayer.name}
          onConfirm={handleChallengeConfirm}
        />
      )}
    </div>
  );
};

export default Duels;
