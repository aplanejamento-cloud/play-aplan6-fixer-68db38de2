import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ThumbsDown, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PostModerationBarProps {
  postId: string;
  dislikes: number;
  denuncias: number;
  temaTitle?: string;
  temaFator?: number;
}

const REPORT_CATEGORIES = [
  { value: "spam", label: "🗑️ Spam / Propaganda" },
  { value: "ofensivo", label: "🤬 Conteúdo Ofensivo" },
  { value: "impróprio", label: "🔞 Conteúdo Impróprio" },
  { value: "falso", label: "🤥 Informação Falsa" },
];

const PostModerationBar = ({ postId, dislikes, denuncias, temaTitle, temaFator }: PostModerationBarProps) => {
  const { user } = useAuth();
  const [localDislikes, setLocalDislikes] = useState(dislikes);
  const [localDenuncias, setLocalDenuncias] = useState(denuncias);
  const [hasDisliked, setHasDisliked] = useState(false);
  const [hasReported, setHasReported] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check if user already voted - silently skip if table doesn't exist
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("post_moderation_votes" as any)
      .select("vote_type")
      .eq("post_id", postId)
      .eq("user_id", user.id)
      .then(({ data, error }) => {
        if (error) return; // silently ignore missing table
        const votes = (data || []) as any[];
        setHasDisliked(votes.some((v: any) => v.vote_type === "dislike"));
        setHasReported(votes.some((v: any) => v.vote_type === "report"));
      });
  }, [user?.id, postId]);

  const handleDislike = async () => {
    if (!user || hasDisliked || loading) return;
    setLoading(true);

    // Insert vote record
    const { error: voteErr } = await supabase
      .from("post_moderation_votes" as any)
      .insert({ post_id: postId, user_id: user.id, vote_type: "dislike" });

    if (voteErr) {
      setLoading(false);
      if (voteErr.code === "23505") toast.error("Você já deu dislike neste post");
      return;
    }

    // Update post counter
    const newCount = localDislikes + 1;
    await supabase
      .from("posts")
      .update({ dislikes_tema: newCount } as any)
      .eq("id", postId);

    setLocalDislikes(newCount);
    setHasDisliked(true);
    setLoading(false);

    if (newCount >= 10) {
      toast.success("🚨 Post deletado automaticamente por 10 dislikes!");
    } else {
      toast.success(`👎 Dislike registrado (${newCount}/10)`);
    }
  };

  const handleReport = async (categoria: string) => {
    if (!user || hasReported || loading) return;
    setLoading(true);
    setShowReportDialog(false);

    // Insert vote record
    const { error: voteErr } = await supabase
      .from("post_moderation_votes" as any)
      .insert({ post_id: postId, user_id: user.id, vote_type: "report", categoria });

    if (voteErr) {
      setLoading(false);
      if (voteErr.code === "23505") toast.error("Você já denunciou este post");
      return;
    }

    // Update post counters
    const newCount = localDenuncias + 1;
    await supabase
      .from("posts")
      .update({ denuncias_improprio: newCount, denuncia_categoria: categoria } as any)
      .eq("id", postId);

    setLocalDenuncias(newCount);
    setHasReported(true);
    setLoading(false);

    if (newCount >= 10) {
      toast.success("🚨 Post deletado automaticamente por 10 denúncias!");
    } else {
      toast.success(`✅ Denúncia enviada! (${newCount}/10)`);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 text-xs">
        {temaTitle && (
          <span className="bg-accent/20 text-accent px-2 py-0.5 rounded-full font-medium">
            🎯 {temaTitle} {temaFator}x
          </span>
        )}
        <button
          onClick={handleDislike}
          disabled={hasDisliked || loading}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-full transition-colors",
            hasDisliked ? "bg-yellow-500/20 text-yellow-500" : "text-muted-foreground hover:bg-muted"
          )}
        >
          <ThumbsDown className="w-3.5 h-3.5" />
          <span>👎 {localDislikes}/10</span>
        </button>
        <button
          onClick={() => {
            if (!user) return toast.error("Faça login para denunciar");
            if (hasReported) return toast.error("Você já denunciou este post");
            setShowReportDialog(true);
          }}
          disabled={hasReported || loading}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-full transition-colors",
            hasReported ? "bg-destructive/20 text-destructive" : "text-muted-foreground hover:bg-muted"
          )}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>🚨 {localDenuncias}/10</span>
        </button>
      </div>

      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>🚨 Denunciar Post</DialogTitle>
            <DialogDescription>Selecione o motivo da denúncia:</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-2">
            {REPORT_CATEGORIES.map((cat) => (
              <Button
                key={cat.value}
                variant="outline"
                className="justify-start text-left"
                onClick={() => handleReport(cat.value)}
              >
                {cat.label}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PostModerationBar;
