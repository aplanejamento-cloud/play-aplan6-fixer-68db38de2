import { useMemo, useEffect, useRef, useState } from "react";

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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
        if (!entry.isIntersecting && iframeRef.current) {
          // Pause video when out of view
          iframeRef.current.contentWindow?.postMessage(
            JSON.stringify({ event: "command", func: "pauseVideo", args: "" }),
            "*"
          );
        }
      },
      { threshold: 0.1 }
    );

    if (iframeRef.current) {
      observer.observe(iframeRef.current);
    }

    return () => observer.disconnect();
  }, []);

  if (!videoId) return null;

  return (
    <div className="w-full aspect-video rounded-lg overflow-hidden bg-black">
      <iframe
        ref={iframeRef}
        src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1`}
        title="YouTube video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="w-full h-full border-0"
        loading="lazy"
      />
    </div>
  );
};

export { extractYouTubeId };
export default YouTubeEmbed;
