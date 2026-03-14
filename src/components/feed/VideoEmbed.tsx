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
        ? `https://www.youtube.com/embed/${m[1]}?enablejsapi=1&modestbranding=1&rel=0&playsinline=1&controls=1&showinfo=0&iv_load_policy=3&origin=${window.location.origin}`
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

const VideoEmbed = ({ url }: VideoEmbedProps) => {
  const platform = useMemo(() => detectPlatform(url), [url]);
  const embedUrl = useMemo(() => (platform ? getEmbedUrl(url, platform) : null), [url, platform]);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const instanceId = useMemo(
    () => `embed-${platform}-${Math.random().toString(36).slice(2, 8)}`,
    [platform]
  );

  // YouTube postMessage commands
  const sendYTCommand = useCallback(
    (func: string, args?: unknown) => {
      if (platform !== "youtube") return;
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func, args: args ?? "" }),
        "*"
      );
    },
    [platform]
  );

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

  // Seek ±15s (YouTube only)
  const handleSeek = useCallback(
    (delta: number) => {
      if (platform !== "youtube") return;
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({
          event: "command",
          func: "getCurrentTime",
          args: "",
        }),
        "*"
      );
      // Since we can't easily get current time, use seekTo with relative
      // We'll just use the YouTube API seekTo approach
      sendYTCommand("seekBy", [delta]);
    },
    [platform, sendYTCommand]
  );

  // Mute toggle (YouTube only)
  const handleMute = useCallback(() => {
    if (platform !== "youtube") return;
    if (muted) {
      sendYTCommand("unMute");
    } else {
      sendYTCommand("mute");
    }
    setMuted(!muted);
  }, [platform, muted, sendYTCommand]);

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
    // Also listen to old youtube-play events for backwards compat
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

  const isYouTube = platform === "youtube";
  const videoId = isYouTube
    ? url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/)?.[1]
    : null;
  const thumbnailUrl = videoId
    ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    : null;

  return (
    <div ref={containerRef} className="relative w-full aspect-video rounded-lg overflow-hidden bg-black">
      {/* IFRAME - always rendered for non-YouTube, lazy for YouTube */}
      <iframe
        ref={iframeRef}
        src={isYouTube ? (playing ? `${embedUrl}&autoplay=1` : embedUrl) : embedUrl}
        title={`${PLATFORM_LABELS[platform]} video`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
        allowFullScreen={false}
        className="w-full h-full border-0"
        style={{
          display: isYouTube && !playing ? "none" : "block",
          pointerEvents: isYouTube ? "auto" : "auto",
        }}
      />

      {/* Block external links overlay - covers logo areas */}
      {(playing || !isYouTube) && (
        <>
          {/* Top-right: YouTube logo / platform branding */}
          <div
            className="absolute top-0 right-0 w-28 h-14 z-20 cursor-default"
            style={{ pointerEvents: "auto" }}
            onClick={(e) => e.stopPropagation()}
          />
          {/* Bottom-right: fullscreen button area */}
          <div
            className="absolute bottom-0 right-0 w-12 h-12 z-20 cursor-default"
            style={{ pointerEvents: "auto" }}
            onClick={(e) => e.stopPropagation()}
          />
          {/* For non-YouTube: also block top-left branding */}
          {!isYouTube && (
            <div
              className="absolute top-0 left-0 w-28 h-14 z-20 cursor-default"
              style={{ pointerEvents: "auto" }}
              onClick={(e) => e.stopPropagation()}
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

      {/* YouTube external controls bar */}
      {isYouTube && playing && (
        <div className="absolute bottom-0 left-0 right-0 z-30 flex items-center justify-center gap-1 py-1.5 px-2 bg-black/70">
          <button
            onClick={() => handleSeek(-15)}
            className="p-1.5 rounded text-white/80 hover:text-white transition-colors"
            title="-15s"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={handleToggle}
            className="p-1.5 rounded text-white/80 hover:text-white transition-colors"
          >
            {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-white" />}
          </button>
          <button
            onClick={() => handleSeek(15)}
            className="p-1.5 rounded text-white/80 hover:text-white transition-colors"
            title="+15s"
          >
            <SkipForward className="w-4 h-4" />
          </button>
          <button
            onClick={handleMute}
            className="p-1.5 rounded text-white/80 hover:text-white transition-colors ml-2"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
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
