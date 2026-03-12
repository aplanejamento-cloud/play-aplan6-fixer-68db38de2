import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import InviteButton from "@/components/InviteButton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Download, Trash2, Filter } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  "Todos", "Ação", "Aventura", "Romance", "Ficção Científica", "Fantasia", 
  "Terror", "Suspense", "Autoajuda", "Negócios", "Educação", "Outros"
];

const Ebooks = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState("Todos");

  const { data: ebooks = [], isLoading } = useQuery({
    queryKey: ["ebooks", selectedCategory],
    queryFn: async () => {
      const query = supabase
        .from("ebooks")
        .select("*")
        .order("created_at", { ascending: false }) as any;
      
      if (selectedCategory !== "Todos") {
        query.eq("categoria", selectedCategory);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!data) return [];
      // Fetch profile names
      const userIds = [...new Set(data.map((e: any) => e.user_id))] as string[];
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

        {/* Category Filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-3 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-all",
                selectedCategory === cat 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
          </div>
        ) : ebooks.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">Nenhum ebook publicado ainda.</p>
        ) : (
          ebooks.map((eb: any) => (
            <Card key={eb.id} className="border-border overflow-hidden">
              <div className="flex h-32">
                <div className="w-24 bg-muted flex-shrink-0 relative">
                  {eb.capa_url ? (
                    <img src={eb.capa_url} alt={eb.titulo} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FileText className="w-8 h-8 text-muted-foreground/40" />
                    </div>
                  )}
                  {eb.categoria && (
                    <span className="absolute top-1 left-1 bg-primary/90 text-primary-foreground text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase">
                      {eb.categoria}
                    </span>
                  )}
                </div>
                <CardContent className="flex-1 p-3 flex flex-col justify-between min-w-0">
                  <div>
                    <p className="text-sm font-bold text-foreground truncate">{eb.titulo}</p>
                    <p className="text-[10px] text-muted-foreground mb-1">por {eb.profile?.name || "Anônimo"}</p>
                    {eb.descricao && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-tight">
                        {eb.descricao}
                      </p>
                    )}
                  </div>
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" asChild>
                      <a href={eb.pdf_url} target="_blank" rel="noopener noreferrer">
                        <Download className="w-3.5 h-3.5 mr-1" /> Baixar
                      </a>
                    </Button>
                    {user?.id === eb.user_id && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => deleteMut.mutate(eb.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </div>
            </Card>
          ))
        )}
      </main>
    </div>
  );
};

export default Ebooks;
