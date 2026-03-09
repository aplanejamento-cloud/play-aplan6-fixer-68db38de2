import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCreatePost } from "@/hooks/usePosts";
import { useMediaUpload } from "@/hooks/useMediaUpload";
import { useAuth } from "@/contexts/AuthContext";
import { Image, Video, X, Send, Loader2, Trophy } from "lucide-react";
import { toast } from "sonner";

interface ChallengeProofModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  desafioTexto: string;
  desafioId: string;
}

const ChallengeProofModal = ({ open, onOpenChange, desafioTexto, desafioId }: ChallengeProofModalProps) => {
  const { profile } = useAuth();
  const createPost = useCreatePost();
  const { upload, uploading, ACCEPT } = useMediaUpload();

  const [content, setContent] = useState("");
  const [images, setImages] = useState<{ file: File; url: string }[]>([]);
  const [video, setVideo] = useState<{ file: File; url: string } | null>(null);

  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setContent("");
    images.forEach((img) => URL.revokeObjectURL(img.url));
    setImages([]);
    if (video) URL.revokeObjectURL(video.url);
    setVideo(null);
  };

  const handleImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const remaining = 5 - images.length;
    const toAdd = files.slice(0, remaining);
    const previews = toAdd.map((file) => ({ file, url: URL.createObjectURL(file) }));
    setImages((prev) => [...prev, ...previews]);
    if (toAdd.length < files.length) toast.error("Máximo 5 fotos para prova!");
    e.target.value = "";
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (video) URL.revokeObjectURL(video.url);
    setVideo({ file, url: URL.createObjectURL(file) });
    e.target.value = "";
  };

  const handleSubmit = async () => {
    if (images.length === 0 && !video) {
      toast.error("Adicione pelo menos uma foto ou vídeo como prova!");
      return;
    }

    try {
      let imageUrl: string | undefined;
      let videoUrl: string | undefined;
      const additionalImages: string[] = [];

      for (const img of images) {
        const url = await upload(img.file, "image");
        if (url) {
          if (!imageUrl) imageUrl = url;
          else additionalImages.push(url);
        }
      }

      if (video) {
        const url = await upload(video.file, "video");
        if (url) videoUrl = url;
      }

      const shortDesafio = desafioTexto.length > 80 ? desafioTexto.slice(0, 80) + "…" : desafioTexto;
      const postContent = `🏆 Desafio completado!\n\n"${shortDesafio}"\n\n${content.trim() ? content.trim() : "Fiz isso! 💪"}`;

      await createPost.mutateAsync({
        content: postContent,
        imageUrl,
        videoUrl,
        additionalImages,
        categoria: "desafio-prova",
      });

      toast.success("Prova do desafio publicada! 🏆");
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error("Erro ao publicar prova");
      console.error(error);
    }
  };

  const isSubmitting = createPost.isPending || uploading;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md bg-card border-primary/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary font-cinzel">
            <Trophy className="w-5 h-5" /> Fiz isso! — Prova do Desafio
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Challenge reference */}
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Desafio:</p>
            <p className="text-sm text-foreground font-medium">{desafioTexto}</p>
          </div>

          {/* Optional comment */}
          <Textarea
            placeholder="Comente sobre sua prova (opcional)..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[60px] bg-background border-border resize-none"
            maxLength={300}
          />

          {/* Image previews */}
          {images.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {images.map((img, i) => (
                <div key={i} className="relative w-16 h-16">
                  <img src={img.url} className="w-full h-full rounded-md object-cover" />
                  <button type="button" onClick={() => {
                    URL.revokeObjectURL(img.url);
                    setImages((prev) => prev.filter((_, idx) => idx !== i));
                  }} className="absolute -top-1 -right-1 bg-destructive rounded-full p-0.5">
                    <X className="w-3 h-3 text-destructive-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Video preview */}
          {video && (
            <div className="relative">
              <video src={video.url} controls className="w-full rounded-lg max-h-40" />
              <button type="button" onClick={() => { URL.revokeObjectURL(video.url); setVideo(null); }} className="absolute top-2 right-2 bg-background/80 rounded-full p-1">
                <X className="w-4 h-4 text-foreground" />
              </button>
            </div>
          )}

          {/* Media buttons */}
          <div className="flex items-center gap-2">
            <input ref={imageRef} type="file" accept={ACCEPT.image} multiple className="hidden" onChange={handleImagesChange} />
            <input ref={videoRef} type="file" accept={ACCEPT.video} className="hidden" onChange={handleVideoChange} />

            <Button variant="outline" size="sm" onClick={() => imageRef.current?.click()} disabled={isSubmitting || images.length >= 5}>
              <Image className="w-4 h-4 mr-1" /> Foto
            </Button>
            <Button variant="outline" size="sm" onClick={() => videoRef.current?.click()} disabled={isSubmitting || !!video}>
              <Video className="w-4 h-4 mr-1" /> Vídeo
            </Button>

            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || (images.length === 0 && !video)}
              className="ml-auto bg-primary text-primary-foreground"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-1" /> Publicar Prova</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ChallengeProofModal;
