import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AppHeader from "@/components/AppHeader";
import UnifiedEditorModal from "@/components/feed/UnifiedEditorModal";
import { Button } from "@/components/ui/button";
import { Paintbrush } from "lucide-react";
import { useSearchParams } from "react-router-dom";

const Editor = () => {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const remixImage = searchParams.get("image") || undefined;
  const remixCaption = searchParams.get("caption") ? decodeURIComponent(searchParams.get("caption")!) : undefined;

  const [showEditor, setShowEditor] = useState(true);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container mx-auto px-4 py-6 max-w-2xl text-center space-y-6">
        <h1 className="font-cinzel text-2xl text-foreground">
          Editor <span className="text-primary">PlayLike</span> ✨
        </h1>
        <p className="text-muted-foreground text-sm">
          Crie conteúdos incríveis com fotos, vídeos e músicas!
        </p>
        <Button onClick={() => setShowEditor(true)} className="bg-primary hover:bg-primary/90">
          <Paintbrush className="w-4 h-4 mr-2" />
          Abrir Editor
        </Button>

        <UnifiedEditorModal
          open={showEditor}
          onOpenChange={setShowEditor}
          mode="post"
          initialImage={remixImage}
          initialCaption={remixCaption}
        />
      </main>
    </div>
  );
};

export default Editor;
