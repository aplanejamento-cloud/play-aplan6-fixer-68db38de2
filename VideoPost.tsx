import { useRef, useEffect, useState } from "react";
import { Volume2, VolumeX, RotateCcw, Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoPostProps {
  src: string;
}

const VideoPost = ({ src }: VideoPostProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(true);
  const [ended, setEnded] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {});
          setEnded(false);
          setPlaying(true);
        } else {
          video.pause();
          setPlaying(false);
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const handleReplay = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    video.play().catch(() => {});
    setEnded(false);
    setPlaying(true);
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) {
      video.pause();
      setPlaying(false);
    } else {
      video.play().catch(() => {});
      setPlaying(true);
      setEnded(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden bg-black group">
      <video
        ref={videoRef}
        src={src}
        muted={muted}
        playsInline
        preload="metadata"
        onEnded={() => { setEnded(true); setPlaying(false); }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onClick={togglePlay}
        className="w-full object-contain cursor-pointer"
        style={{ maxHeight: "85vh" }}
      />
      
      {/* Center Play/Pause Overlay (visible on hover or when paused) */}
      <div 
        className={cn(
          "absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity",
          playing ? "opacity-0 group-hover:opacity-100" : "opacity-100"
        )}
      >
        <button 
          onClick={(e) => { e.stopPropagation(); togglePlay(); }}
          className="p-4 rounded-full bg-black/40 text-white backdrop-blur-sm pointer-events-auto hover:bg-black/60 transition-all"
        >
          {playing ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
        </button>
      </div>

      <div className="absolute bottom-3 right-3 flex gap-2">
        <button
          onClick={() => setMuted(!muted)}
          className="p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        {ended && (
          <button
            onClick={handleReplay}
            className="p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default VideoPost;
