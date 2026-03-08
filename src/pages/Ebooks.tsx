import AppHeader from "@/components/AppHeader";
import InviteButton from "@/components/InviteButton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Download, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const Ebooks = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: ebooks = [], isLoading } = useQuery({
    queryKey: ["ebooks"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ebooks")
        .select("*")
        .order("created_at", { ascending: false });
      if (!data) return [];
      // Fetch profile names
      const userIds = [...new Set(data.map((e: any) => e.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name, avatar_url")
        .in("user_id", userIds);
      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      return data.map((e: any) => ({ ...e, profile: profileMap.get(e.user_id) }));
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ebooks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ebooks"] });
      toast.success("Ebook removido!");
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <InviteButton />
      <main className="container mx-auto px-4 py-6 max-w-lg space-y-6">
        <h1 className="font-cinzel text-2xl text-primary text-center">📚 Ebooks</h1>
        <p className="text-sm text-muted-foreground text-center">
          PDFs publicados pela comunidade
        </p>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
          </div>
        ) : ebooks.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">Nenhum ebook publicado ainda.</p>
        ) : (
          ebooks.map((eb: any) => (
            <Card key={eb.id} className="border-border">
              <CardContent className="py-3 flex items-center gap-3">
                <div className="bg-primary/10 rounded-lg p-2">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{eb.titulo}</p>
                  <p className="text-xs text-muted-foreground">por {eb.profiles?.name || "Anônimo"}</p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" asChild>
                    <a href={eb.pdf_url} target="_blank" rel="noopener noreferrer">
                      <Download className="w-4 h-4" />
                    </a>
                  </Button>
                  {user?.id === eb.user_id && (
                    <Button size="sm" variant="ghost" onClick={() => deleteMut.mutate(eb.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </div>
  );
};

export default Ebooks;
