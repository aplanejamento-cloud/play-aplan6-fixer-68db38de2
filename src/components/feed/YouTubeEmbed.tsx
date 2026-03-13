import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { Play } from "lucide-react";

interface YouTubeEmbedProps {
  url: string;
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

const YouTubeEmbed = ({ url }: YouTubeEmbedProps) => {
  const videoId = useMemo(() => extractYouTubeId(url), [url]);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [playing, setPlaying] = useState(false);
  const instanceId = useMemo(() => `yt-${videoId}-${Math.random().toString(36).slice(2, 8)}`, [videoId]);

  const sendCommand = useCallback((func: string) => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args: "" }),
      "*"
    );
  }, []);

  // Toggle play/pause on overlay click
  const handleToggle = useCallback(() => {
    if (playing) {
      sendCommand("pauseVideo");
      setPlaying(false);
    } else {
      // Notify other players to stop
      window.dispatchEvent(new CustomEvent("youtube-play", { detail: instanceId }));
      sendCommand("playVideo");
      setPlaying(true);
    }
  }, [playing, sendCommand, instanceId]);

  // Pause when another YouTube player starts
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail !== instanceId) {
        sendCommand("pauseVideo");
        setPlaying(false);
      }
    };
    window.addEventListener("youtube-play", handler);
    return () => window.removeEventListener("youtube-play", handler);
  }, [instanceId, sendCommand]);

  // IntersectionObserver: auto-pause when out of viewport
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          sendCommand("pauseVideo");
          setPlaying(false);
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, [sendCommand]);

  if (!videoId) return null;

  const iframeSrc = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&modestbranding=1&rel=0&playsinline=1&controls=1&showinfo=0&iv_load_policy=3&origin=${window.location.origin}`;
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  return (
    <div ref={containerRef} className="relative w-full aspect-video rounded-lg overflow-hidden bg-black">
      {playing ? (
        <iframe
          ref={iframeRef}
          src={`${iframeSrc}&autoplay=1`}
          title="YouTube video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen={false}
          className="w-full h-full border-0"
        />
      ) : (
        <img
          src={thumbnailUrl}
          alt="YouTube video thumbnail"
          className="w-full h-full object-cover"
        />
      )}
      {/* Overlay: only shown when not playing to start video */}
      {!playing && (
        <div
          onClick={handleToggle}
          className="absolute inset-0 cursor-pointer flex items-center justify-center z-10"
        >
          <div className="bg-black/70 rounded-full p-5 text-white hover:bg-black/90 transition-colors shadow-lg">
            <Play className="w-10 h-10 fill-white" />
          </div>
        </div>
      )}
    </div>
  );
};

export { extractYouTubeId };
export default YouTubeEmbed;
