"use client";

import { useState } from "react";

interface ExternalEmbedProps {
  src: string;
  provider: "youtube" | "vimeo" | "dailymotion" | "wistia" | string;
  title?: string;
  className?: string;
}

const ALLOW_BY_PROVIDER: Record<string, string> = {
  youtube:
    "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
  vimeo: "autoplay; fullscreen; picture-in-picture",
  dailymotion: "autoplay; fullscreen; picture-in-picture",
  wistia: "autoplay; fullscreen",
};

export function ExternalEmbed({
  src,
  provider,
  title = "Video",
  className = "",
}: ExternalEmbedProps) {
  const [loaded, setLoaded] = useState(false);
  const allow = ALLOW_BY_PROVIDER[provider] ?? "autoplay; fullscreen";

  return (
    <div
      className={`relative w-full overflow-hidden rounded-none sm:rounded-lg bg-black ${className}`}
      style={{ aspectRatio: "16/9" }}
    >
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-brand-grey-light/20 animate-pulse">
          <div className="w-16 h-16 rounded-full bg-brand-grey-light/40" />
        </div>
      )}
      <iframe
        src={src}
        title={title}
        className="absolute inset-0 w-full h-full border-0"
        allow={allow}
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
        loading="lazy"
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}
