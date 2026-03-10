"use client";

import { useEffect, useRef } from "react";

/**
 * Video Player — HLS.js for adaptive streaming
 * omnilearn.space | Phase 2
 */

interface VideoPlayerProps {
  src: string;
  hlsUrl?: string;
  poster?: string;
  className?: string;
  onTimeUpdate?: (currentTime: number) => void;
}

export function VideoPlayer({
  src,
  hlsUrl,
  poster,
  className = "",
  onTimeUpdate,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const isHls = hlsUrl || src.endsWith(".m3u8");
    const url = hlsUrl || src;

    if (isHls && typeof window !== "undefined") {
      import("hls.js").then(({ default: Hls }) => {
        if (Hls.isSupported()) {
          const hls = new Hls();
          hls.loadSource(url);
          hls.attachMedia(video);
          return () => hls.destroy();
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = url;
        }
      });
    } else {
      video.src = url;
    }
  }, [src, hlsUrl]);

  return (
    <div className={`overflow-hidden rounded-lg bg-black ${className}`}>
      <video
        ref={videoRef}
        className="w-full aspect-video"
        controls
        poster={poster}
        onTimeUpdate={(e) => onTimeUpdate?.(e.currentTarget.currentTime)}
      />
    </div>
  );
}
