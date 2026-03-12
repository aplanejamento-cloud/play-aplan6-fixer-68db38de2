import { useState, useRef, useCallback, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMediaUpload } from "@/hooks/useMediaUpload";
import { useCreatePost } from "@/hooks/usePosts";
import { useTemas } from "@/hooks/useTemas";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Upload, Download, Send, X, Type, Smile, Sparkles, RotateCcw,
  SunMedium, Contrast, Droplets, Palette, Zap, Moon, Eye, Layers,
  Image as ImageIcon, Hourglass, Music
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

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
  "🍀", "🌸", "🌻", "🎭", "🃏", "♠️", "♥️", "♦️", "♣️", "🎲",
  "⚡", "💰", "🎁", "🏅", "🥇", "🥈", "🥉", "👸", "🤴", "🦁",
];

const MUSIC_TRACKS = [
  { name: "🎵 Trap Beat", genre: "trap", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
  { name: "🔥 Funk Pesado", genre: "funk", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
  { name: "⚡ Pop Vibe", genre: "pop", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" },
  { name: "🎹 Eletrônica", genre: "electronic", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3" },
];

interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  fontSize: number;
}

interface EmojiOverlay {
  id: string;
  emoji: string;
  x: number;
  y: number;
  size: number;
}

interface OverlayImage {
  id: string;
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const Editor = () => {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const remixPostId = searchParams.get("remix");
  const remixImageUrl = searchParams.get("image");
  const remixCaption = searchParams.get("caption");
  const temaIdParam = searchParams.get("tema");

  // Fetch tema data from DB
  const { data: temaData } = useQuery({
    queryKey: ["tema-editor", temaIdParam],
    queryFn: async () => {
      if (!temaIdParam) return null;
      const { data } = await supabase.from("temas").select("*").eq("id", temaIdParam).maybeSingle();
      return data;
    },
    enabled: !!temaIdParam,
  });

  const [image, setImage] = useState<string | null>(remixImageUrl || null);
  const [video, setVideo] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [cropRange, setCropRange] = useState({ start: 0, end: 10 });
  const videoRef = useRef<HTMLVideoElement>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [activeFilter, setActiveFilter] = useState(0);
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [emojiOverlays, setEmojiOverlays] = useState<EmojiOverlay[]>([]);
  const [overlayImages, setOverlayImages] = useState<OverlayImage[]>([]);
  const [showEmojis, setShowEmojis] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [showMusic, setShowMusic] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [newText, setNewText] = useState("");
  const [textColor, setTextColor] = useState("#ffffff");
  const [postCaption, setPostCaption] = useState(remixCaption ? decodeURIComponent(remixCaption) : "");
  const [dragging, setDragging] = useState<{ type: "text" | "emoji" | "image"; id: string } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayInputRef = useRef<HTMLInputElement>(null);
  const { upload, uploading } = useMediaUpload();
  const createPost = useCreatePost();

  useEffect(() => {
    if (selectedMusic) {
      const track = MUSIC_TRACKS.find(t => t.genre === selectedMusic);
      if (track && audioRef.current) {
        audioRef.current.src = track.url;
        audioRef.current.play().catch(() => console.log("Autoplay blocked"));
        audioRef.current.loop = true;
      }
    } else {
      audioRef.current?.pause();
    }
    return () => audioRef.current?.pause();
  }, [selectedMusic]);

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOriginalFile(file);
    const url = URL.createObjectURL(file);
    
    if (file.type.startsWith("video/")) {
      setVideo(url);
      setImage(null);
    } else {
      setImage(url);
      setVideo(null);
    }
    
    setActiveFilter(0);
    setTextOverlays([]);
    setEmojiOverlays([]);
    setOverlayImages([]);
  };

  const onVideoLoad = () => {
    if (videoRef.current) {
      setVideoDuration(videoRef.current.duration);
      setCropRange({ start: 0, end: Math.min(10, videoRef.current.duration) });
    }
  };

  const handleOverlayUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setOverlayImages(prev => [...prev, {
      id: Date.now().toString(),
      url,
      x: 50,
      y: 50,
      width: 100,
      height: 100
    }]);
  };

  const addTextOverlay = () => {
    if (!newText.trim()) return;
    setTextOverlays(prev => [...prev, {
      id: Date.now().toString(),
      text: newText,
      x: 50, y: 50,
      color: textColor,
      fontSize: 24,
    }]);
    setNewText("");
    setShowTextInput(false);
  };

  const addEmoji = (emoji: string) => {
    setEmojiOverlays(prev => [...prev, {
      id: Date.now().toString(),
      emoji,
      x: 50, y: 50,
      size: 40,
    }]);
  };

  const handlePointerDown = (type: "text" | "emoji" | "image", id: string) => {
    setDragging({ type, id });
  };

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const clampedX = Math.max(0, Math.min(100, x));
    const clampedY = Math.max(0, Math.min(100, y));

    if (dragging.type === "text") {
      setTextOverlays(prev => prev.map(t => t.id === dragging.id ? { ...t, x: clampedX, y: clampedY } : t));
    } else if (dragging.type === "emoji") {
      setEmojiOverlays(prev => prev.map(e => e.id === dragging.id ? { ...e, x: clampedX, y: clampedY } : e));
    } else {
      setOverlayImages(prev => prev.map(img => img.id === dragging.id ? { ...img, x: clampedX, y: clampedY } : img));
    }
  }, [dragging]);

  const handlePointerUp = () => setDragging(null);

  const removeOverlay = (type: "text" | "emoji" | "image", id: string) => {
    if (type === "text") setTextOverlays(prev => prev.filter(t => t.id !== id));
    else if (type === "emoji") setEmojiOverlays(prev => prev.filter(e => e.id !== id));
    else setOverlayImages(prev => prev.filter(img => img.id !== id));
  };

  const renderToCanvas = (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const canvas = canvasRef.current;
      if (!canvas || (!image && !video)) return reject("No canvas/media");

      const ctx = canvas.getContext("2d")!;

      const processCanvas = async (source: HTMLImageElement | HTMLVideoElement) => {
        const width = source instanceof HTMLImageElement ? source.width : source.videoWidth;
        const height = source instanceof HTMLImageElement ? source.height : source.videoHeight;
        
        canvas.width = width;
        canvas.height = height;
        
        ctx.filter = FILTERS[activeFilter].css;
        ctx.drawImage(source, 0, 0);
        ctx.filter = "none";

        // Draw overlay images
        for (const overlay of overlayImages) {
          const oImg = new window.Image();
          oImg.crossOrigin = "anonymous";
          await new Promise((res) => {
            oImg.onload = () => {
              const ox = (overlay.x / 100) * canvas.width;
              const oy = (overlay.y / 100) * canvas.height;
              const ow = (overlay.width / 400) * canvas.width;
              const oh = (overlay.height / 400) * canvas.height;
              ctx.drawImage(oImg, ox - ow/2, oy - oh/2, ow, oh);
              res(null);
            };
            oImg.src = overlay.url;
          });
        }

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
          const size = (e.size / 400) * canvas.width;
          ctx.font = `${size}px sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText(e.emoji, px, py);
        });

        const wmSize = canvas.width * 0.03;
        ctx.font = `bold ${wmSize}px sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.textAlign = "right";
        ctx.fillText("PlayLike ✨", canvas.width - 10, canvas.height - 10);

        canvas.toBlob(blob => blob ? resolve(blob) : reject("toBlob failed"), "image/jpeg", 0.92);
      };

      if (video && videoRef.current) {
        processCanvas(videoRef.current);
      } else if (image) {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.onload = () => processCanvas(img);
        img.onerror = reject;
        img.src = image;
      }
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

  const handlePost = async () => {
    if (!image && !video) return;
    try {
      let url = "";
      if (video) {
        url = await upload(originalFile!, "video");
      } else {
        const blob = await renderToCanvas();
        const file = new File([blob], `editor-${Date.now()}.jpg`, { type: "image/jpeg" });
        url = await upload(file, "image");
      }
      
      if (!url) return;

      const postData: any = {
        content: postCaption || `Criado no Editor PlayLike ✨${temaData ? ` | Tema: ${temaData.titulo}` : ""}`,
        imageUrl: video ? null : url,
        videoUrl: video ? url : null,
        metadata: video ? { crop: cropRange } : null
      };

      const result = await createPost.mutateAsync(postData);

      // If tema, update multiplicador on the post
      if (temaData && result?.id) {
        await supabase.from("posts").update({ multiplicador: temaData.fator } as any).eq("id", result.id);
      }

      toast.success(temaData ? `Post publicado com ${temaData.fator}x likes! 🎉` : "Post publicado! 🎉");
      navigate("/feed");
    } catch { toast.error("Erro ao publicar"); }
  };

  const isProcessing = uploading || createPost.isPending;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container mx-auto px-4 py-6 max-w-3xl space-y-4">
        <h1 className="font-cinzel text-2xl text-center text-foreground">
          Editor <span className="text-primary">PlayLike</span> ✨
        </h1>

        {/* Tema side-by-side layout */}
        {temaData ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* LEFT: Tema info */}
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-primary/10 border border-primary/30 space-y-2">
                <p className="font-cinzel text-lg text-primary text-center">🎨 {temaData.titulo}</p>
                <p className="text-center text-sm text-foreground">⭐ {temaData.fator}x likes</p>
                {(temaData as any).midia_url && (
                  <img src={(temaData as any).midia_url} alt={temaData.titulo} className="w-full max-h-48 object-cover rounded-lg" />
                )}
                <p className="text-xs text-muted-foreground text-center">
                  Likes serão multiplicados por <span className="text-primary font-bold">{temaData.fator}x</span>
                </p>
              </div>
            </div>

            {/* RIGHT: Upload + editor */}
            <div className="space-y-4">
              {!image && !video ? (
                <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors bg-card">
                  <Upload className="w-10 h-10 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground text-sm">Selecionar foto ou vídeo</p>
                  <input type="file" accept="image/*,video/*" className="hidden" onChange={handleMediaUpload} />
                </label>
              ) : (
                <EditorCanvas
                  image={image} video={video} videoRef={videoRef} onVideoLoad={onVideoLoad}
                  activeFilter={activeFilter} textOverlays={textOverlays}
                  emojiOverlays={emojiOverlays} overlayImages={overlayImages}
                  containerRef={containerRef}
                  handlePointerMove={handlePointerMove} handlePointerUp={handlePointerUp}
                  handlePointerDown={handlePointerDown} removeOverlay={removeOverlay}
                />
              )}

              {video && (
                <div className="space-y-2 p-3 bg-card border border-border rounded-lg">
                  <p className="text-xs font-bold text-primary">CORTAR VÍDEO (Segundos)</p>
                  <div className="flex gap-4 items-center">
                    <div className="flex-1 space-y-1">
                      <p className="text-[10px] text-muted-foreground">Início: {cropRange.start}s</p>
                      <input 
                        type="range" min={0} max={videoDuration} step={0.1}
                        value={cropRange.start} onChange={e => setCropRange(prev => ({ ...prev, start: parseFloat(e.target.value) }))}
                        className="w-full accent-primary"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-[10px] text-muted-foreground">Fim: {cropRange.end}s</p>
                      <input 
                        type="range" min={0} max={videoDuration} step={0.1}
                        value={cropRange.end} onChange={e => setCropRange(prev => ({ ...prev, end: parseFloat(e.target.value) }))}
                        className="w-full accent-primary"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-center text-primary font-bold">Duração: {(cropRange.end - cropRange.start).toFixed(1)}s</p>
                </div>
              )}

              <Textarea
                placeholder={`Este usuário escolheu o tema "${temaData.titulo}". Poste algo relacionado!`}
                value={postCaption}
                onChange={e => setPostCaption(e.target.value)}
                className="min-h-[120px] bg-card border-border"
                maxLength={500}
              />

              <Button
                className="w-full font-cinzel text-lg bg-primary hover:bg-primary/90"
                onClick={handlePost}
                disabled={isProcessing || (!image && !video)}
              >
                {isProcessing ? <Hourglass className="w-5 h-5 animate-spin mr-2" /> : <Send className="w-5 h-5 mr-2" />}
                Publicar {temaData.fator}x 🚀
              </Button>
            </div>
          </div>
        ) : (
          /* Normal editor (no tema) */
          <>
            {!image && !video ? (
              <label className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors bg-card">
                <Upload className="w-12 h-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground text-sm">Toque para selecionar foto ou vídeo</p>
                <input type="file" accept="image/*,video/*" className="hidden" onChange={handleMediaUpload} />
              </label>
            ) : (
              <>
                <EditorCanvas
                  image={image} video={video} videoRef={videoRef} onVideoLoad={onVideoLoad}
                  activeFilter={activeFilter} textOverlays={textOverlays}
                  emojiOverlays={emojiOverlays} overlayImages={overlayImages}
                  containerRef={containerRef}
                  handlePointerMove={handlePointerMove} handlePointerUp={handlePointerUp}
                  handlePointerDown={handlePointerDown} removeOverlay={removeOverlay}
                />

                {video && (
                  <div className="space-y-2 p-3 bg-card border border-border rounded-lg">
                    <p className="text-xs font-bold text-primary">CORTAR VÍDEO (Segundos)</p>
                    <div className="flex gap-4 items-center">
                      <div className="flex-1 space-y-1">
                        <p className="text-[10px] text-muted-foreground">Início: {cropRange.start}s</p>
                        <input 
                          type="range" min={0} max={videoDuration} step={0.1}
                          value={cropRange.start} onChange={e => setCropRange(prev => ({ ...prev, start: parseFloat(e.target.value) }))}
                          className="w-full accent-primary"
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-[10px] text-muted-foreground">Fim: {cropRange.end}s</p>
                        <input 
                          type="range" min={0} max={videoDuration} step={0.1}
                          value={cropRange.end} onChange={e => setCropRange(prev => ({ ...prev, end: parseFloat(e.target.value) }))}
                          className="w-full accent-primary"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-center text-primary font-bold">Duração: {(cropRange.end - cropRange.start).toFixed(1)}s</p>
                  </div>
                )}

                {/* Filters */}
                <div className="overflow-x-auto">
                  <div className="flex gap-2 pb-2">
                    {FILTERS.map((f, i) => (
                      <button
                        key={f.name}
                        onClick={() => setActiveFilter(i)}
                        className={cn(
                          "flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all min-w-[60px]",
                          i === activeFilter ? "bg-primary/20 text-primary border border-primary/30" : "bg-card border border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <f.icon className="w-4 h-4" />
                        {f.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tools */}
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => setShowTextInput(!showTextInput)}>
                    <Type className="w-4 h-4 mr-1" /> Texto
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowEmojis(!showEmojis)}>
                    <Smile className="w-4 h-4 mr-1" /> Emojis
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowMusic(!showMusic)}>
                    <Music className="w-4 h-4 mr-1" /> Música
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => overlayInputRef.current?.click()}>
                    <Layers className="w-4 h-4 mr-1" /> Sobrepor
                  </Button>
                  <input type="file" ref={overlayInputRef} className="hidden" accept="image/*" onChange={handleOverlayUpload} />
                  <Button variant="outline" size="sm" onClick={() => { setImage(null); setVideo(null); setTextOverlays([]); setEmojiOverlays([]); setOverlayImages([]); setActiveFilter(0); }}>
                    <RotateCcw className="w-4 h-4 mr-1" /> Resetar
                  </Button>
                </div>

                {/* Text input */}
                {showTextInput && (
                  <div className="flex gap-2 items-end bg-card p-3 rounded-lg border border-border">
                    <Input value={newText} onChange={e => setNewText(e.target.value)} placeholder="Digite o texto..." className="flex-1" maxLength={50} />
                    <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer" />
                    <Button size="sm" onClick={addTextOverlay} disabled={!newText.trim()}>Adicionar</Button>
                  </div>
                )}

                {/* Emoji picker */}
                {showEmojis && (
                  <div className="grid grid-cols-10 gap-1 bg-card p-3 rounded-lg border border-border max-h-40 overflow-y-auto">
                    {EMOJIS.map(e => (
                      <button key={e} onClick={() => addEmoji(e)} className="text-2xl hover:scale-125 transition-transform p-1">
                        {e}
                      </button>
                    ))}
                  </div>
                )}

                {/* Music picker */}
                {showMusic && (
                  <div className="flex gap-2 bg-card p-3 rounded-lg border border-border">
                    {MUSIC_TRACKS.map(t => (
                      <Button
                        key={t.genre}
                        variant={selectedMusic === t.genre ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedMusic(selectedMusic === t.genre ? null : t.genre)}
                      >
                        {t.name}
                      </Button>
                    ))}
                  </div>
                )}

                {/* Caption */}
                <Textarea
                  placeholder="Legenda do post (opcional)..."
                  value={postCaption}
                  onChange={e => setPostCaption(e.target.value)}
                  className="min-h-[60px] bg-card border-border"
                  maxLength={500}
                />

                {/* Actions */}
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={handleDownload} disabled={isProcessing || !!video}>
                    <Download className="w-4 h-4 mr-1" /> Baixar
                  </Button>
                  <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={handlePost} disabled={isProcessing}>
                    {isProcessing ? <Hourglass className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                    Postar
                  </Button>
                </div>
              </>
            )}
          </>
        )}

        <canvas ref={canvasRef} className="hidden" />
        
        {selectedMusic && (
          <audio
            ref={audioRef}
            src={MUSIC_TRACKS.find(t => t.genre === selectedMusic)?.url}
            autoPlay
            loop
            className="hidden"
          />
        )}

        {remixPostId && (
          <p className="text-xs text-center text-muted-foreground">
            🔄 Remixando post original — o autor receberá +10 likes!
          </p>
        )}
      </main>
    </div>
  );
};

// Extracted canvas preview component
const EditorCanvas = ({
  image, video, videoRef, onVideoLoad, activeFilter, textOverlays, emojiOverlays, overlayImages, containerRef,
  handlePointerMove, handlePointerUp, handlePointerDown, removeOverlay,
}: {
  image: string | null;
  video: string | null;
  videoRef: React.RefObject<HTMLVideoElement>;
  onVideoLoad: () => void;
  activeFilter: number;
  textOverlays: TextOverlay[];
  emojiOverlays: EmojiOverlay[];
  overlayImages: OverlayImage[];
  containerRef: React.RefObject<HTMLDivElement>;
  handlePointerMove: (e: React.PointerEvent) => void;
  handlePointerUp: () => void;
  handlePointerDown: (type: "text" | "emoji" | "image", id: string) => void;
  removeOverlay: (type: "text" | "emoji" | "image", id: string) => void;
}) => (
  <div
    ref={containerRef}
    className="relative rounded-xl overflow-hidden border border-border bg-black touch-none select-none"
    onPointerMove={handlePointerMove}
    onPointerUp={handlePointerUp}
    onPointerLeave={handlePointerUp}
  >
    {image ? (
      <img
        src={image}
        alt="Editor"
        className="w-full block"
        style={{ filter: FILTERS[activeFilter].css }}
        draggable={false}
      />
    ) : (
      <video
        ref={videoRef}
        src={video!}
        className="w-full block"
        onLoadedMetadata={onVideoLoad}
        autoPlay loop muted playsInline
        style={{ filter: FILTERS[activeFilter].css }}
      />
    )}
    
    {overlayImages.map(img => (
      <div
        key={img.id}
        className="absolute cursor-move group"
        style={{
          left: `${img.x}%`, top: `${img.y}%`,
          width: `${img.width}px`, height: `${img.height}px`,
          transform: "translate(-50%, -50%)",
          userSelect: "none",
        }}
        onPointerDown={() => handlePointerDown("image", img.id)}
      >
        <img src={img.url} className="w-full h-full object-contain" draggable={false} />
        <button
          onClick={(e) => { e.stopPropagation(); removeOverlay("image", img.id); }}
          className="absolute -top-2 -right-2 w-5 h-5 bg-destructive rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="w-3 h-3 text-white" />
        </button>
      </div>
    ))}

    {textOverlays.map(t => (
      <div
        key={t.id}
        className="absolute cursor-move group"
        style={{
          left: `${t.x}%`, top: `${t.y}%`,
          transform: "translate(-50%, -50%)",
          color: t.color, fontSize: t.fontSize, fontWeight: "bold",
          textShadow: "2px 2px 4px rgba(0,0,0,0.8)", userSelect: "none",
          whiteSpace: "nowrap"
        }}
        onPointerDown={() => handlePointerDown("text", t.id)}
      >
        {t.text}
        <button
          onClick={(e) => { e.stopPropagation(); removeOverlay("text", t.id); }}
          className="absolute -top-2 -right-2 w-5 h-5 bg-destructive rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="w-3 h-3 text-white" />
        </button>
      </div>
    ))}

    {emojiOverlays.map(e => (
      <div
        key={e.id}
        className="absolute cursor-move group"
        style={{
          left: `${e.x}%`, top: `${e.y}%`,
          transform: "translate(-50%, -50%)",
          fontSize: e.size, userSelect: "none",
        }}
        onPointerDown={() => handlePointerDown("emoji", e.id)}
      >
        {e.emoji}
        <button
          onClick={(ev) => { ev.stopPropagation(); removeOverlay("emoji", e.id); }}
          className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="w-2.5 h-2.5 text-white" />
        </button>
      </div>
    ))}
  </div>
);

export default Editor;
