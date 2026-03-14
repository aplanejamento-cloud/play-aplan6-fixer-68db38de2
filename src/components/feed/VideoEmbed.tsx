import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { Play } from "lucide-react";

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
  const [started, setStarted] = useState(false);
  const instanceId = useMemo(
    () => `embed-${platform}-${Math.random().toString(36).slice(2, 8)}`,
    [platform]
  );

  const isYouTube = platform === "youtube";

  const sendYTCommand = useCallback(
    (func: string) => {
      if (!isYouTube) return;
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func, args: "" }),
        "*"
      );
    },
    [isYouTube]
  );

  // Start playing (YouTube: swap to autoplay src)
  const handlePlay = useCallback(() => {
    window.dispatchEvent(new CustomEvent("video-embed-play", { detail: instanceId }));
    setStarted(true);
  }, [instanceId]);

  // Pause when another embed starts
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail !== instanceId) {
        sendYTCommand("pauseVideo");
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
      if (document.visibilityState === "hidden") {
        sendYTCommand("pauseVideo");
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [sendYTCommand]);

  if (!platform || !embedUrl) return null;

  const videoId = isYouTube
    ? url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/)?.[1]
    : null;
  const thumbnailUrl = videoId
    ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    : null;

  return (
    <div ref={containerRef} className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black">
      {/* IFRAME */}
      <iframe
        ref={iframeRef}
        src={isYouTube && started ? `${embedUrl}&autoplay=1` : embedUrl}
        title={`${PLATFORM_LABELS[platform]} video`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
        allowFullScreen
        className="w-full h-full border-0 rounded-2xl"
        style={{ display: isYouTube && !started ? "none" : "block" }}
      />

      {/* CLICK BLOCKER - prevents navigating away (always active) */}
      <div
        className="absolute inset-0 z-10 bg-transparent"
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
        onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
        onTouchStart={(e) => { e.stopPropagation(); e.preventDefault(); }}
        onDoubleClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
        style={{ pointerEvents: "auto" }}
      />

      {/* YouTube: thumbnail + play button before started */}
      {isYouTube && !started && thumbnailUrl && (
        <>
          <img
            src={thumbnailUrl}
            alt="Video thumbnail"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div
            onClick={handlePlay}
            className="absolute inset-0 cursor-pointer flex items-center justify-center z-20"
          >
            <div className="bg-black/70 rounded-full p-5 text-white hover:bg-black/90 transition-colors shadow-lg">
              <Play className="w-10 h-10 fill-white" />
            </div>
          </div>
        </>
      )}

      {/* Platform badge */}
      <div className="absolute top-2 right-2 z-20 px-2 py-1 bg-black/80 rounded text-white text-xs font-medium">
        {PLATFORM_LABELS[platform]}
      </div>
    </div>
  );
};

export default VideoEmbed;
