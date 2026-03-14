import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";

interface VideoEmbedProps {
  url: string;
}

type Platform = "youtube" | "instagram" | "tiktok" | "kwai" | "facebook" | null;

function detectPlatform(url: string): Platform {
  if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
  if (/instagram\.com/i.test(url)) return "instagram";
  if (/tiktok\.com/i.test(url)) return "tiktok";
  if (/kwai\.com/i.test(url)) return "kwai";
  if (/facebook\.com|fb\.watch/i.test(url)) return "facebook";
  return null;
}

function getEmbedUrl(url: string, platform: Platform): string | null {
  switch (platform) {
    case "youtube": {
      const m = url.match(
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
      );
      return m
        ? `https://www.youtube.com/embed/${m[1]}?enablejsapi=1&modestbranding=1&rel=0&playsinline=1&controls=0&showinfo=0&iv_load_policy=3&origin=${window.location.origin}`
        : null;
    }
    case "instagram": {
      const m = url.match(/instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
      return m ? `https://www.instagram.com/p/${m[1]}/embed` : null;
    }
    case "tiktok": {
      const m = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/);
      return m ? `https://www.tiktok.com/embed/v2/${m[1]}` : null;
    }
    case "kwai": {
      const m = url.match(/kwai\.com\/.*(?:\?|&)vid=([^&]+)/);
      if (m) return `https://www.kwai.com/embed/video/${m[1]}`;
      const m2 = url.match(/kwai\.com\/(?:watch|video)\/([^?&#]+)/);
      return m2 ? `https://www.kwai.com/embed/video/${m2[1]}` : null;
    }
    case "facebook": {
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&width=560`;
    }
    default:
      return null;
  }
}

const PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
  kwai: "Kwai",
  facebook: "Facebook",
};

export function extractVideoUrl(text: string): { url: string; platform: Platform } | null {
  const urlMatch = text.match(
    /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|instagram\.com\/(?:p|reel)\/|tiktok\.com\/@[^\s]+\/video\/|kwai\.com\/[^\s]+|facebook\.com\/[^\s]+|fb\.watch\/[^\s]+)[^\s]*/i
  );
  if (!urlMatch) return null;
  const url = urlMatch[0];
  const platform = detectPlatform(url);
  if (!platform) return null;
  return { url, platform };
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const VideoEmbed = ({ url }: VideoEmbedProps) => {
  const platform = useMemo(() => detectPlatform(url), [url]);
  const embedUrl = useMemo(() => (platform ? getEmbedUrl(url, platform) : null), [url, platform]);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const instanceId = useMemo(
    () => `embed-${platform}-${Math.random().toString(36).slice(2, 8)}`,
    [platform]
  );

  const isYouTube = platform === "youtube";

  // YouTube postMessage commands
  const sendYTCommand = useCallback(
    (func: string, args?: unknown) => {
      if (!isYouTube) return;
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func, args: args ?? "" }),
        "*"
      );
    },
    [isYouTube]
  );

  // Listen for YouTube iframe API state messages
  useEffect(() => {
    if (!isYouTube) return;

    const handler = (e: MessageEvent) => {
      if (typeof e.data !== "string") return;
      try {
        const data = JSON.parse(e.data);
        if (data.event === "infoDelivery" && data.info) {
          if (typeof data.info.currentTime === "number" && !isSeeking) {
            setCurrentTime(data.info.currentTime);
          }
          if (typeof data.info.duration === "number" && data.info.duration > 0) {
            setDuration(data.info.duration);
          }
          if (typeof data.info.muted === "boolean") {
            setMuted(data.info.muted);
          }
          if (typeof data.info.playerState === "number") {
            // 0=ended, 1=playing, 2=paused
            if (data.info.playerState === 1) setPlaying(true);
            else if (data.info.playerState === 2 || data.info.playerState === 0) setPlaying(false);
          }
        }
      } catch {
        // ignore non-JSON messages
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [isYouTube, isSeeking]);

  // Poll for time updates when playing (YouTube iframe API sends infoDelivery)
  useEffect(() => {
    if (isYouTube && playing) {
      // Request current time periodically by listening to iframe events
      // The YouTube iframe API sends infoDelivery automatically when enablejsapi=1
      pollRef.current = setInterval(() => {
        sendYTCommand("getDuration");
        sendYTCommand("getCurrentTime");
      }, 500);
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isYouTube, playing, sendYTCommand]);

  // Play/pause toggle
  const handleToggle = useCallback(() => {
    if (playing) {
      sendYTCommand("pauseVideo");
      setPlaying(false);
    } else {
      window.dispatchEvent(new CustomEvent("video-embed-play", { detail: instanceId }));
      sendYTCommand("playVideo");
      setPlaying(true);
    }
  }, [playing, sendYTCommand, instanceId]);

  // Seek ±delta seconds (YouTube only)
  const handleSeek = useCallback(
    (delta: number) => {
      if (!isYouTube) return;
      const newTime = Math.max(0, Math.min(currentTime + delta, duration));
      sendYTCommand("seekTo", [newTime, true]);
      setCurrentTime(newTime);
    },
    [isYouTube, currentTime, duration, sendYTCommand]
  );

  // Seek to specific percentage from progress bar
  const handleProgressChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!isYouTube || duration <= 0) return;
      const pct = parseFloat(e.target.value);
      const newTime = (pct / 100) * duration;
      setCurrentTime(newTime);
      setIsSeeking(true);
      sendYTCommand("seekTo", [newTime, true]);
      // Release seeking lock after a short delay
      setTimeout(() => setIsSeeking(false), 600);
    },
    [isYouTube, duration, sendYTCommand]
  );

  // Mute toggle (YouTube only)
  const handleMute = useCallback(() => {
    if (!isYouTube) return;
    if (muted) {
      sendYTCommand("unMute");
    } else {
      sendYTCommand("mute");
    }
    setMuted(!muted);
  }, [isYouTube, muted, sendYTCommand]);

  // Pause when another embed starts
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail !== instanceId) {
        sendYTCommand("pauseVideo");
        setPlaying(false);
      }
    };
    window.addEventListener("video-embed-play", handler);
    window.addEventListener("youtube-play", handler);
    return () => {
      window.removeEventListener("video-embed-play", handler);
      window.removeEventListener("youtube-play", handler);
    };
  }, [instanceId, sendYTCommand]);

  // Pause when out of viewport
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          sendYTCommand("pauseVideo");
          setPlaying(false);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [sendYTCommand]);

  // Pause on tab visibility change
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "hidden" && playing) {
        sendYTCommand("pauseVideo");
        setPlaying(false);
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [playing, sendYTCommand]);

  if (!platform || !embedUrl) return null;

  const videoId = isYouTube
    ? url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/)?.[1]
    : null;
  const thumbnailUrl = videoId
    ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    : null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div ref={containerRef} className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black">
      {/* IFRAME - always behind (z-0) */}
      <iframe
        ref={iframeRef}
        src={isYouTube ? (playing ? `${embedUrl}&autoplay=1` : embedUrl) : embedUrl}
        title={`${PLATFORM_LABELS[platform]} video`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
        allowFullScreen
        className="w-full h-full border-0 rounded-2xl z-0 relative"
        style={{
          display: isYouTube && !playing ? "none" : "block",
        }}
      />

      {/* FULL CLICK BLOCKER - prevents navigating away */}
      {playing && (
        <div
          className="absolute inset-0 z-[5]"
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        />
      )}

      {/* Block external links overlay - platform logos */}
      {(playing || !isYouTube) && (
        <>
          <div
            className="absolute top-0 right-0 w-28 h-14 z-30 cursor-default"
            style={{ pointerEvents: "auto" }}
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
          />
          <div
            className="absolute bottom-0 right-0 w-12 h-12 z-30 cursor-default"
            style={{ pointerEvents: "auto" }}
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
          />
          {!isYouTube && (
            <div
              className="absolute top-0 left-0 w-28 h-14 z-30 cursor-default"
              style={{ pointerEvents: "auto" }}
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
            />
          )}
        </>
      )}

      {/* YouTube: thumbnail + play button before playing */}
      {isYouTube && !playing && thumbnailUrl && (
        <>
          <img
            src={thumbnailUrl}
            alt="Video thumbnail"
            className="w-full h-full object-cover"
          />
          <div
            onClick={handleToggle}
            className="absolute inset-0 cursor-pointer flex items-center justify-center z-10"
          >
            <div className="bg-black/70 rounded-full p-5 text-white hover:bg-black/90 transition-colors shadow-lg">
              <Play className="w-10 h-10 fill-white" />
            </div>
          </div>
        </>
      )}

      {/* CONTROL BUTTONS - floating above video (z-20) */}
      {playing && (
        <div className="absolute bottom-20 left-4 right-4 mx-2 flex items-center gap-3 bg-black/80 backdrop-blur-sm p-3 rounded-2xl z-20">
          {isYouTube && (
            <button
              onClick={() => handleSeek(-15)}
              className="p-2 text-xl text-white hover:bg-white/20 rounded-xl transition-colors"
              title="-15s"
            >
              ⏪
            </button>
          )}

          <button
            onClick={handleToggle}
            className="p-3 text-3xl text-white hover:bg-white/20 rounded-2xl transition-colors"
          >
            {playing ? "⏸️" : "▶️"}
          </button>

          {isYouTube && (
            <button
              onClick={() => handleSeek(15)}
              className="p-2 text-xl text-white hover:bg-white/20 rounded-xl transition-colors"
              title="+15s"
            >
              ⏩
            </button>
          )}

          <button
            onClick={handleMute}
            className="ml-auto p-2 text-xl text-white hover:bg-white/20 rounded-xl transition-colors"
          >
            {muted ? "🔇" : "🔊"}
          </button>
        </div>
      )}

      {/* PROGRESS BAR - bottom, YouTube only (z-10) */}
      {playing && isYouTube && (
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/95 to-transparent z-10">
          <div className="flex text-xs text-white mb-2">
            <span>{formatTime(currentTime)}</span>
            <span className="ml-auto">{formatTime(duration)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={progress}
            onChange={handleProgressChange}
            className="w-full h-2 rounded-full appearance-none cursor-pointer bg-white/20
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-red-600 [&::-webkit-slider-thumb]:shadow-md
              [&::-webkit-slider-thumb]:hover:scale-125 [&::-webkit-slider-thumb]:transition-transform
              [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:bg-red-600 [&::-moz-range-thumb]:border-0"
            style={{
              background: `linear-gradient(to right, #dc2626 ${progress}%, rgba(255,255,255,0.2) ${progress}%)`,
            }}
          />
        </div>
      )}

      {/* Platform badge */}
      <div className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-black/60 rounded text-white text-xs font-medium">
        {PLATFORM_LABELS[platform]}
      </div>
    </div>
  );
};

export default VideoEmbed;
