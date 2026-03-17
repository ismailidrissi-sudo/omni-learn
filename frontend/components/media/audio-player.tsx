"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/context";

/**
 * Audio Player — Generic audio with speed controls
 * omnilearn.space | For audio content (lectures, narration, etc.)
 */

interface AudioPlayerProps {
  audioUrl: string;
  title?: string;
  className?: string;
  onTimeUpdate?: (currentTime: number) => void;
  onEnded?: () => void;
}

export function AudioPlayer({
  audioUrl,
  title,
  className = "",
  onTimeUpdate,
  onEnded,
}: AudioPlayerProps) {
  const { t } = useI18n();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playbackRate, setPlaybackRate] = useState(1);

  const speeds = [0.75, 1, 1.25, 1.5, 1.75, 2];

  return (
    <div className={`rounded-lg border border-brand-grey-light bg-white p-4 ${className}`}>
      {title && (
        <h3 className="text-brand-grey-dark font-semibold mb-3">{title}</h3>
      )}
      <audio
        ref={audioRef}
        src={audioUrl}
        controls
        className="w-full"
        onTimeUpdate={(e) => onTimeUpdate?.(e.currentTarget.currentTime)}
        onEnded={() => onEnded?.()}
      />
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <span className="text-brand-grey text-sm">{t("podcast.speed")}:</span>
        {speeds.map((s) => (
          <button
            key={s}
            onClick={() => {
              setPlaybackRate(s);
              if (audioRef.current) audioRef.current.playbackRate = s;
            }}
            className={`px-2 py-1 text-sm rounded ${
              playbackRate === s
                ? "bg-brand-purple text-white"
                : "bg-brand-grey-light text-brand-grey-dark hover:bg-brand-grey"
            }`}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
}
