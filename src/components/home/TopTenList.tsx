import { forwardRef } from "react";
import { Heart, Medal } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";

interface TopPlayer {
  id: string;
  userId?: string;
  name: string;
  avatarUrl?: string;
  likes: number;
  position: number;
}

interface TopTenListProps {
  players: TopPlayer[];
}

const getMedalColor = (position: number) => {
  switch (position) {
    case 1:
      return "text-primary"; // Gold
    case 2:
      return "text-gray-300"; // Silver
    case 3:
      return "text-orange-400"; // Bronze
    default:
      return "text-muted-foreground";
  }
};

const TopTenList = forwardRef<HTMLDivElement, TopTenListProps>(
  ({ players }, ref) => {
    const navigate = useNavigate();
    return (
      <div ref={ref} className="space-y-4">
      <div className="flex items-center gap-2 justify-center mb-6">
        <Medal className="w-5 h-5 md:w-6 md:h-6 text-primary" />
        <h3 className="font-cinzel text-lg md:text-xl lg:text-2xl font-bold text-foreground">
          Top 10 Jogadores
        </h3>
        <Medal className="w-5 h-5 md:w-6 md:h-6 text-primary" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
        {players.map((player) => (
          <div
            key={player.id}
            onClick={() => player.name && navigate(`/@${encodeURIComponent(player.name)}`)}
            className="flex flex-col items-center gap-2 p-3 md:p-4 rounded-xl bg-card/60 border border-border hover:border-primary/50 hover:shadow-gold transition-all duration-300 group cursor-pointer"
          >
            {/* Position badge */}
            <div className={`flex items-center gap-1 ${getMedalColor(player.position)}`}>
              {player.position <= 3 && (
                <Medal className="w-4 h-4" fill="currentColor" />
              )}
              <span className="font-cinzel text-sm font-bold">
                #{player.position}
              </span>
            </div>

            {/* Avatar */}
            <div className="relative">
              <Avatar className="w-14 h-14 md:w-16 md:h-16 border-2 border-border group-hover:border-primary/50 transition-colors">
                <AvatarImage src={player.avatarUrl} alt={player.name} className="object-cover" />
                <AvatarFallback className="bg-secondary text-foreground font-cinzel">
                  {player.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* Name */}
            <span className="font-montserrat text-xs md:text-sm text-foreground text-center truncate w-full">
              {player.name}
            </span>

            {/* Likes */}
            <div className="flex items-center gap-1 text-muted-foreground">
              <Heart className="w-3 h-3" fill="currentColor" />
              <span className="text-xs">
                {player.likes.toLocaleString("pt-BR")}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

TopTenList.displayName = "TopTenList";

export default TopTenList;
