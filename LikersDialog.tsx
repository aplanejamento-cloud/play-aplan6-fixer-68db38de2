import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { Heart, Flame, Bomb } from "lucide-react";

interface LikersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
}

const LikersDialog = ({ open, onOpenChange, postId }: LikersDialogProps) => {
  const navigate = useNavigate();

  const { data: likers = [], isLoading } = useQuery({
    queryKey: ["post-likers", postId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("post_interactions")
        .select(`
          user_id,
          type,
          value,
          profiles:user_id (
            name,
            avatar_url
          )
        `)
        .eq("post_id", postId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const getIcon = (type: string) => {
    switch (type) {
      case "like": return <Heart className="w-3 h-3 text-primary fill-primary" />;
      case "love": return <Flame className="w-3 h-3 text-orange-500 fill-orange-500" />;
      case "bomb": return <Bomb className="w-3 h-3 text-destructive fill-destructive" />;
      default: return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[80vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-cinzel text-primary">Interações</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          {isLoading ? (
            [...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)
          ) : likers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma interação ainda.</p>
          ) : (
            likers.map((interaction: any, i: number) => (
              <div 
                key={i}
                onClick={() => {
                  navigate(`/profile/${interaction.user_id}`);
                  onOpenChange(false);
                }}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <Avatar className="w-10 h-10 border border-border">
                  <AvatarImage src={interaction.profiles?.avatar_url || ""} />
                  <AvatarFallback className="bg-secondary">{interaction.profiles?.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{interaction.profiles?.name}</p>
                  <div className="flex items-center gap-1">
                    {getIcon(interaction.type)}
                    <span className="text-[10px] text-muted-foreground capitalize">
                      {interaction.type === "love" ? "Lacrou" : interaction.type === "bomb" ? "Bomba" : "Curtiu"}
                    </span>
                  </div>
                </div>
                <span className={interaction.value > 0 ? "text-primary font-bold text-xs" : "text-destructive font-bold text-xs"}>
                  {interaction.value > 0 ? `+${interaction.value}` : interaction.value}
                </span>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LikersDialog;
