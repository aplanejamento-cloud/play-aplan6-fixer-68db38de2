import { useState, useRef, useCallback } from "react";
import { useTemas, Tema } from "@/hooks/useTemas";
import { useAuth } from "@/contexts/AuthContext";
import { useMediaUpload } from "@/hooks/useMediaUpload";
import { useCreatePost } from "@/hooks/usePosts";
import AppHeader from "@/components/AppHeader";
import GlobalNav from "@/components/GlobalNav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, ArrowRight, Upload, Send, X, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Temas = () => {
  const { temas, isLoading } = useTemas();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [selectedTema, setSelectedTema] = useState<Tema | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const { upload, uploading } = useMediaUpload();
  const createPost = useCreatePost();
  const isProcessing = uploading || createPost.isPending;

  const handleSelectTema = (tema: Tema) => {
    setSelectedTema(tema);
    setImage(null);
    setImageFile(null);
    setCaption("");
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImage(URL.createObjectURL(file));
  };

  const handlePost = async () => {
    if (!image || !imageFile || !selectedTema || !user) return;
    try {
      const url = await upload(imageFile, "image");
      if (!url) return;

      const result = await createPost.mutateAsync({
        content: caption || `Criado no tema "${selectedTema.titulo}" ✨`,
        imageUrl: url,
      });

      if (result?.id) {
        await supabase.from("posts").update({
          tema_id: selectedTema.id,
          multiplicador: selectedTema.fator,
        } as any).eq("id", result.id);
      }

      toast.success(`✅ Post publicado com ${selectedTema.fator}x likes!`);
      navigate("/feed");
    } catch {
      toast.error("Erro ao publicar");
    }
  };

  const handleBack = () => {
    setSelectedTema(null);
    setImage(null);
    setImageFile(null);
    setCaption("");
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <GlobalNav />

      {/* LIST VIEW */}
      {!selectedTema && (
        <div className="max-w-2xl mx-auto p-4 space-y-4">
          <div className="text-center space-y-2">
            <h1 className="font-cinzel text-2xl text-primary flex items-center justify-center gap-2">
              <Sparkles className="w-6 h-6" /> Temas Multiplicadores
            </h1>
            <p className="text-muted-foreground text-sm">
              Escolha um tema para ganhar um multiplicador de likes!
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
                      <img src={tema.midia_url} alt={tema.titulo} className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-cinzel text-lg text-foreground truncate">{tema.titulo}</h3>
                      <p className="text-primary font-bold text-sm">Multiplicador: {tema.fator}x</p>
                    </div>
                    <Button onClick={() => handleSelectTema(tema)} className="bg-primary hover:bg-primary/90 flex-shrink-0">
                      <ArrowRight className="w-4 h-4 mr-1" /> Postar
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SIDE-BY-SIDE EDITOR VIEW */}
      {selectedTema && (
        <div className="max-w-5xl mx-auto p-4">
          <Button variant="ghost" size="sm" onClick={handleBack} className="mb-3 text-muted-foreground">
            <ChevronLeft className="w-4 h-4 mr-1" /> Voltar aos temas
          </Button>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* LEFT: Tema Preview */}
            <div className="space-y-4">
              <Card className="p-5 border-primary/30 bg-primary/5 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <h2 className="font-cinzel text-xl text-primary">{selectedTema.titulo}</h2>
                </div>

                {selectedTema.midia_url && (
                  <img
                    src={selectedTema.midia_url}
                    alt={selectedTema.titulo}
                    className="w-full rounded-lg object-cover max-h-64"
                  />
                )}

                <div className="bg-primary/10 rounded-lg p-3 text-center">
                  <p className="text-3xl font-bold text-primary">{selectedTema.fator}x</p>
                  <p className="text-sm text-muted-foreground">Multiplicador de likes</p>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  Poste conteúdo condizente com o tema para ganhar <span className="text-primary font-bold">{selectedTema.fator}x likes</span> em cada interação!
                </p>
              </Card>
            </div>

            {/* RIGHT: Photo Editor */}
            <div className="space-y-4">
              {!image ? (
                <label className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors bg-card">
                  <Upload className="w-12 h-12 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground text-sm">Selecionar foto para o tema</p>
                  <p className="text-xs text-primary mt-1">"{selectedTema.titulo}"</p>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
              ) : (
                <div className="relative">
                  <img src={image} alt="Preview" className="w-full rounded-xl object-contain max-h-80 bg-card border border-border" />
                  <button
                    onClick={() => { setImage(null); setImageFile(null); }}
                    className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1.5"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-2 left-2 bg-primary/90 text-primary-foreground rounded-full px-3 py-1 text-xs font-bold flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> {selectedTema.fator}x {selectedTema.titulo}
                  </div>
                </div>
              )}

              <Textarea
                placeholder={`Escreva algo sobre "${selectedTema.titulo}"...`}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="min-h-[100px] bg-card border-border"
                maxLength={500}
              />

              <Button
                className="w-full font-cinzel text-lg bg-primary hover:bg-primary/90 h-12"
                onClick={handlePost}
                disabled={isProcessing || !image}
              >
                {isProcessing ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <Send className="w-5 h-5 mr-2" />
                )}
                Publicar com {selectedTema.fator}x 🚀
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Temas;
