import { useState, useRef, useCallback } from "react";
import { useMediaUpload } from "@/hooks/useMediaUpload";
import { useCreatePost } from "@/hooks/usePosts";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Upload, Download, Send, X, Type, Smile, Sparkles, RotateCcw,
  SunMedium, Contrast, Droplets, Palette, Zap, Moon, Eye, Layers,
  Loader2, Music, Crop, ZoomIn, RotateCw, Video, Image as ImageIcon, Scissors
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const FILTERS = [
  { name: "Normal", css: "none", icon: Eye },
  { name: "Brilho", css: "brightness(1.3)", icon: SunMedium },
  { name: "Contraste", css: "contrast(1.4)", icon: Contrast },
  { name: "Saturar", css: "saturate(1.8)", icon: Droplets },
  { name: "Sépia", css: "sepia(0.8)", icon: Palette },
  { name: "P&B", css: "grayscale(1)", icon: Moon },
  { name: "Inverter", css: "invert(1)", icon: Zap },
  { name: "Blur", css: "blur(2px)", icon: Layers },
  { name: "Vintage", css: "sepia(0.4) contrast(1.2) brightness(0.9)", icon: Sparkles },
  { name: "Frio", css: "saturate(0.8) brightness(1.1) hue-rotate(20deg)", icon: Droplets },
  { name: "Quente", css: "saturate(1.3) brightness(1.05) hue-rotate(-10deg)", icon: SunMedium },
  { name: "Drama", css: "contrast(1.6) saturate(0.6) brightness(0.9)", icon: Contrast },
];

const EMOJIS = [
  "😂", "🔥", "❤️", "🎉", "👑", "💎", "⭐", "🏆", "🎶", "💪",
  "😎", "🤩", "💖", "🌟", "✨", "🎯", "💥", "🚀", "🦋", "🌈",
  "👏", "🙌", "💯", "🎵", "🎸", "🎤", "🎬", "📸", "💫", "🔮",
];

interface TextOverlay { id: string; text: string; x: number; y: number; color: string; fontSize: number; }
interface EmojiOverlay { id: string; emoji: string; x: number; y: number; size: number; }

export type EditorMode = "post" | "avatar";

interface UnifiedEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: EditorMode;
  /** Avatar mode: returns cropped blob instead of posting */
  onAvatarComplete?: (blob: Blob) => void;
  /** Optional initial image URL (e.g. remix) */
  initialImage?: string;
  /** Optional initial caption */
  initialCaption?: string;
}

const UnifiedEditorModal = ({
  open, onOpenChange, mode = "post",
  onAvatarComplete, initialImage, initialCaption,
}: UnifiedEditorModalProps) => {
  // Media state
  const [image, setImage] = useState<string | null>(initialImage || null);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);

  // Filter & overlays
  const [activeFilter, setActiveFilter] = useState(0);
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [emojiOverlays, setEmojiOverlays] = useState<EmojiOverlay[]>([]);
  const [showEmojis, setShowEmojis] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [newText, setNewText] = useState("");
  const [textColor, setTextColor] = useState("#ffffff");
  const [postCaption, setPostCaption] = useState(initialCaption || "");
  const [dragging, setDragging] = useState<{ type: "text" | "emoji"; id: string } | null>(null);

  // Crop/Zoom state
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [showCropTools, setShowCropTools] = useState(mode === "avatar");

  // Video trim state
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(100);
  const [videoDuration, setVideoDuration] = useState(0);
  const [showTrimTools, setShowTrimTools] = useState(false);

  // Active tool panel
  const [activePanel, setActivePanel] = useState<string | null>(mode === "avatar" ? "crop" : null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);
  const { upload, uploading, ACCEPT } = useMediaUpload();
  const createPost = useCreatePost();

  const resetAll = () => {
    setImage(null);
    setVideoFile(null);
    setMusicFile(null);
    setMusicUrl(null);
    setActiveFilter(0);
    setTextOverlays([]);
    setEmojiOverlays([]);
    setShowEmojis(false);
    setShowTextInput(false);
    setNewText("");
    setPostCaption("");
    setZoom(1);
    setRotation(0);
    setTrimStart(0);
    setTrimEnd(100);
    setActivePanel(mode === "avatar" ? "crop" : null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    setMediaType(isVideo ? "video" : "image");
    if (isVideo) {
      setVideoFile(file);
      setShowTrimTools(true);
    }
    setImage(URL.createObjectURL(file));
    setActiveFilter(0);
    setTextOverlays([]);
    setEmojiOverlays([]);
    setZoom(1);
    setRotation(0);
  };

  const handleMusicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (musicUrl) URL.revokeObjectURL(musicUrl);
    setMusicFile(file);
    setMusicUrl(URL.createObjectURL(file));
    toast.success(`🎵 Música: ${file.name}`);
  };

  const addTextOverlay = () => {
    if (!newText.trim()) return;
    setTextOverlays(prev => [...prev, { id: Date.now().toString(), text: newText, x: 50, y: 50, color: textColor, fontSize: 24 }]);
    setNewText("");
    setShowTextInput(false);
    setActivePanel(null);
  };

  const addEmoji = (emoji: string) => {
    setEmojiOverlays(prev => [...prev, { id: Date.now().toString(), emoji, x: 50, y: 50, size: 40 }]);
  };

  const handlePointerDown = (type: "text" | "emoji", id: string) => setDragging({ type, id });

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    if (dragging.type === "text") setTextOverlays(prev => prev.map(t => t.id === dragging.id ? { ...t, x, y } : t));
    else setEmojiOverlays(prev => prev.map(em => em.id === dragging.id ? { ...em, x, y } : em));
  }, [dragging]);

  const handlePointerUp = () => setDragging(null);

  const removeOverlay = (type: "text" | "emoji", id: string) => {
    if (type === "text") setTextOverlays(prev => prev.filter(t => t.id !== id));
    else setEmojiOverlays(prev => prev.filter(e => e.id !== id));
  };

  const renderToCanvas = (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const canvas = canvasRef.current;
      if (!canvas || !image) return reject("No canvas/image");
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        // Handle rotation
        const isRotated = rotation % 180 !== 0;
        const w = isRotated ? img.height : img.width;
        const h = isRotated ? img.width : img.height;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(zoom, zoom);
        ctx.filter = FILTERS[activeFilter].css;
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        ctx.restore();
        ctx.filter = "none";

        // Draw overlays
        textOverlays.forEach(t => {
          const px = (t.x / 100) * canvas.width;
          const py = (t.y / 100) * canvas.height;
          const fontSize = (t.fontSize / 400) * canvas.width;
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.fillStyle = t.color;
          ctx.strokeStyle = "rgba(0,0,0,0.7)";
          ctx.lineWidth = fontSize / 10;
          ctx.textAlign = "center";
          ctx.strokeText(t.text, px, py);
          ctx.fillText(t.text, px, py);
        });
        emojiOverlays.forEach(e => {
          const px = (e.x / 100) * canvas.width;
          const py = (e.y / 100) * canvas.height;
          ctx.font = `${(e.size / 400) * canvas.width}px sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText(e.emoji, px, py);
        });

        // Watermark
        if (mode !== "avatar") {
          const wmSize = canvas.width * 0.03;
          ctx.font = `bold ${wmSize}px sans-serif`;
          ctx.fillStyle = "rgba(255,255,255,0.4)";
          ctx.textAlign = "right";
          ctx.fillText("PlayLike ✨", canvas.width - 10, canvas.height - 10);
        }

        // Avatar mode: crop to square
        if (mode === "avatar") {
          const size = Math.min(canvas.width, canvas.height);
          const cropCanvas = document.createElement("canvas");
          cropCanvas.width = size;
          cropCanvas.height = size;
          const cropCtx = cropCanvas.getContext("2d")!;
          cropCtx.drawImage(canvas, (canvas.width - size) / 2, (canvas.height - size) / 2, size, size, 0, 0, size, size);
          cropCanvas.toBlob(blob => blob ? resolve(blob) : reject("toBlob failed"), "image/jpeg", 0.92);
        } else {
          canvas.toBlob(blob => blob ? resolve(blob) : reject("toBlob failed"), "image/jpeg", 0.92);
        }
      };
      img.onerror = reject;
      img.src = image;
    });
  };

  const handleDownload = async () => {
    try {
      const blob = await renderToCanvas();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `playlike-editor-${Date.now()}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Imagem baixada! 📥");
    } catch { toast.error("Erro ao baixar imagem"); }
  };

  const handleAvatarSave = async () => {
    if (!image || !onAvatarComplete) return;
    try {
      const blob = await renderToCanvas();
      onAvatarComplete(blob);
      resetAll();
      onOpenChange(false);
    } catch { toast.error("Erro ao salvar avatar"); }
  };

  const handlePost = async () => {
    if (!image) return;
    try {
      let imageUrl: string | undefined;
      let videoUrl: string | undefined;
      let musicUploadUrl: string | undefined;

      if (mediaType === "video" && videoFile) {
        const url = await upload(videoFile, "video");
        if (!url) return;
        videoUrl = url;
      } else {
        const blob = await renderToCanvas();
        const file = new File([blob], `editor-${Date.now()}.jpg`, { type: "image/jpeg" });
        const url = await upload(file, "image");
        if (!url) return;
        imageUrl = url;
      }

      if (musicFile) {
        const url = await upload(musicFile, "music");
        if (url) musicUploadUrl = url;
      }

      await createPost.mutateAsync({
        content: postCaption || "Criado no Editor PlayLike ✨",
        imageUrl,
        videoUrl,
        musicUrl: musicUploadUrl,
      });

      toast.success("Post publicado! 🎉");
      resetAll();
      onOpenChange(false);
    } catch { toast.error("Erro ao publicar"); }
  };

  const handleVideoLoaded = () => {
    if (videoRef.current) {
      setVideoDuration(videoRef.current.duration);
      setTrimEnd(100);
    }
  };

  const togglePanel = (panel: string) => {
    setActivePanel(activePanel === panel ? null : panel);
  };

  const isProcessing = uploading || createPost.isPending;
  const isAvatar = mode === "avatar";
  const acceptTypes = isAvatar ? "image/*" : "image/*,video/*";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetAll(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg w-[95vw] max-h-[90vh] overflow-hidden flex flex-col bg-background/95 backdrop-blur-xl p-4 gap-3">
        <DialogTitle className="font-cinzel text-lg text-center">
          {isAvatar ? "Editar Avatar" : "Editor"} <span className="text-primary">PlayLike</span> ✨
        </DialogTitle>

        <input ref={musicInputRef} type="file" accept={ACCEPT.music} className="hidden" onChange={handleMusicUpload} />

        {!image ? (
          <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors bg-card">
            <Upload className="w-10 h-10 text-muted-foreground mb-2" />
            <p className="text-muted-foreground text-sm">
              {isAvatar ? "Selecionar foto do avatar" : "Selecionar foto ou vídeo"}
            </p>
            <input type="file" accept={acceptTypes} className="hidden" onChange={handleFileUpload} />
          </label>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex gap-1.5 flex-wrap">
              {mediaType === "image" && (
                <Button variant={activePanel === "crop" ? "default" : "outline"} size="sm" onClick={() => togglePanel("crop")} className="text-xs h-8">
                  <Crop className="w-3.5 h-3.5 mr-1" />Crop
                </Button>
              )}
              {!isAvatar && (
                <>
                  <Button variant={activePanel === "text" ? "default" : "outline"} size="sm" onClick={() => togglePanel("text")} className="text-xs h-8">
                    <Type className="w-3.5 h-3.5 mr-1" />Texto
                  </Button>
                  <Button variant={activePanel === "emoji" ? "default" : "outline"} size="sm" onClick={() => togglePanel("emoji")} className="text-xs h-8">
                    <Smile className="w-3.5 h-3.5 mr-1" />Emojis
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => musicInputRef.current?.click()} className="text-xs h-8">
                    <Music className="w-3.5 h-3.5 mr-1" />{musicFile ? "✓" : "Música"}
                  </Button>
                </>
              )}
              {mediaType === "video" && !isAvatar && (
                <Button variant={activePanel === "trim" ? "default" : "outline"} size="sm" onClick={() => togglePanel("trim")} className="text-xs h-8">
                  <Scissors className="w-3.5 h-3.5 mr-1" />Cortar
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={resetAll} className="text-xs h-8">
                <RotateCcw className="w-3.5 h-3.5 mr-1" />Reset
              </Button>
            </div>

            {/* Crop/Zoom/Rotate tools */}
            {activePanel === "crop" && mediaType === "image" && (
              <div className="bg-card p-3 rounded-lg border border-border space-y-3">
                <div className="flex items-center gap-2">
                  <ZoomIn className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs text-muted-foreground w-10">Zoom</span>
                  <Slider value={[zoom]} onValueChange={([v]) => setZoom(v)} min={0.5} max={3} step={0.1} className="flex-1" />
                  <span className="text-xs text-foreground w-10 text-right">{zoom.toFixed(1)}x</span>
                </div>
                <div className="flex items-center gap-2">
                  <RotateCw className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs text-muted-foreground w-10">Girar</span>
                  <div className="flex gap-1.5">
                    {[0, 90, 180, 270].map(deg => (
                      <Button key={deg} variant={rotation === deg ? "default" : "outline"} size="sm" className="text-xs h-7 px-2" onClick={() => setRotation(deg)}>
                        {deg}°
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Text input */}
            {activePanel === "text" && (
              <div className="flex gap-2 items-end bg-card p-2 rounded-lg border border-border">
                <Input value={newText} onChange={e => setNewText(e.target.value)} placeholder="Texto..." className="flex-1 h-9" maxLength={50} />
                <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} className="w-9 h-9 rounded cursor-pointer" />
                <Button size="sm" onClick={addTextOverlay} disabled={!newText.trim()} className="h-9">OK</Button>
              </div>
            )}

            {/* Emoji picker */}
            {activePanel === "emoji" && (
              <div className="grid grid-cols-10 gap-0.5 bg-card p-2 rounded-lg border border-border max-h-28 overflow-y-auto">
                {EMOJIS.map(e => (<button key={e} onClick={() => addEmoji(e)} className="text-xl hover:scale-125 transition-transform p-0.5">{e}</button>))}
              </div>
            )}

            {/* Video trim */}
            {activePanel === "trim" && mediaType === "video" && videoDuration > 0 && (
              <div className="bg-card p-3 rounded-lg border border-border space-y-2">
                <div className="flex items-center gap-2">
                  <Scissors className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Início</span>
                  <Slider value={[trimStart]} onValueChange={([v]) => { setTrimStart(v); if (videoRef.current) videoRef.current.currentTime = (v / 100) * videoDuration; }} min={0} max={trimEnd - 1} step={1} className="flex-1" />
                  <span className="text-xs text-foreground w-8">{((trimStart / 100) * videoDuration).toFixed(1)}s</span>
                </div>
                <div className="flex items-center gap-2">
                  <Scissors className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Fim</span>
                  <Slider value={[trimEnd]} onValueChange={([v]) => setTrimEnd(v)} min={trimStart + 1} max={100} step={1} className="flex-1" />
                  <span className="text-xs text-foreground w-8">{((trimEnd / 100) * videoDuration).toFixed(1)}s</span>
                </div>
              </div>
            )}

            {/* Music preview */}
            {musicFile && musicUrl && (
              <div className="flex items-center gap-2 bg-card p-2 rounded-lg border border-border">
                <Music className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-xs text-foreground truncate flex-1">{musicFile.name}</span>
                <audio src={musicUrl} controls className="h-8 flex-1" />
                <button onClick={() => { setMusicFile(null); if (musicUrl) URL.revokeObjectURL(musicUrl); setMusicUrl(null); }} className="p-1">
                  <X className="w-3.5 h-3.5 text-destructive" />
                </button>
              </div>
            )}

            {/* Filters (image only, not avatar) */}
            {mediaType === "image" && (
              <div className="overflow-x-auto scrollbar-thin" style={{ scrollbarWidth: "thin" }}>
                <div className="flex gap-1.5 pb-1">
                  {FILTERS.map((f, i) => (
                    <button key={f.name} onClick={() => setActiveFilter(i)} className={cn("flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all min-w-[48px]", i === activeFilter ? "bg-primary/20 text-primary border border-primary/30" : "bg-card border border-border text-muted-foreground")}>
                      <f.icon className="w-3.5 h-3.5" />
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Preview */}
            <div
              ref={containerRef}
              className={cn("relative rounded-xl overflow-hidden border border-border bg-black touch-none select-none", isAvatar && "aspect-square")}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            >
              {mediaType === "video" ? (
                <video ref={videoRef} src={image} className="w-full block" controls onLoadedMetadata={handleVideoLoaded} style={{ filter: FILTERS[activeFilter].css }} />
              ) : (
                <img
                  src={image}
                  alt="Editor"
                  className={cn("w-full block", isAvatar && "object-cover aspect-square")}
                  style={{
                    filter: FILTERS[activeFilter].css,
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    transformOrigin: "center",
                    transition: "transform 0.2s",
                  }}
                  draggable={false}
                />
              )}
              {/* Overlays */}
              {textOverlays.map(t => (
                <div key={t.id} className="absolute cursor-move" style={{ left: `${t.x}%`, top: `${t.y}%`, transform: "translate(-50%,-50%)", color: t.color, fontSize: t.fontSize, fontWeight: "bold", textShadow: "2px 2px 4px rgba(0,0,0,0.8)", userSelect: "none" }} onPointerDown={() => handlePointerDown("text", t.id)}>
                  {t.text}
                  <button onClick={(e) => { e.stopPropagation(); removeOverlay("text", t.id); }} className="absolute -top-2 -right-2 w-5 h-5 bg-destructive rounded-full flex items-center justify-center"><X className="w-3 h-3 text-white" /></button>
                </div>
              ))}
              {emojiOverlays.map(e => (
                <div key={e.id} className="absolute cursor-move" style={{ left: `${e.x}%`, top: `${e.y}%`, transform: "translate(-50%,-50%)", fontSize: e.size, userSelect: "none" }} onPointerDown={() => handlePointerDown("emoji", e.id)}>
                  {e.emoji}
                  <button onClick={(ev) => { ev.stopPropagation(); removeOverlay("emoji", e.id); }} className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full flex items-center justify-center"><X className="w-2.5 h-2.5 text-white" /></button>
                </div>
              ))}
              {/* Avatar circle guide */}
              {isAvatar && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="w-full h-full rounded-full border-2 border-white/40" />
                </div>
              )}
            </div>

            {/* Caption (post mode only) */}
            {!isAvatar && (
              <Textarea
                placeholder="Legenda (opcional)..."
                value={postCaption}
                onChange={e => setPostCaption(e.target.value)}
                className="min-h-[50px] bg-card border-border text-sm"
                maxLength={500}
              />
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {isAvatar ? (
                <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={handleAvatarSave} disabled={isProcessing}>
                  <Crop className="w-4 h-4 mr-1" />Salvar Avatar
                </Button>
              ) : (
                <>
                  {mediaType === "image" && (
                    <Button variant="outline" className="flex-1" onClick={handleDownload} disabled={isProcessing}>
                      <Download className="w-4 h-4 mr-1" />Baixar
                    </Button>
                  )}
                  <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={handlePost} disabled={isProcessing}>
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                    Postar
                  </Button>
                </>
              )}
            </div>

            <canvas ref={canvasRef} className="hidden" />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default UnifiedEditorModal;
