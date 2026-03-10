"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/context";

/**
 * Podcast Player — Audio with speed controls
 * omnilearn.space | Phase 2
 */

interface PodcastPlayerProps {
  audioUrl: string;
  title?: string;
  transcriptUrl?: string;
  thumbnailUrl?: string;
  className?: string;
  onTimeUpdate?: (currentTime: number) => void;
}

export function PodcastPlayer({
  audioUrl,
  title,
  transcriptUrl,
  thumbnailUrl,
  className = "",
  onTimeUpdate,
}: PodcastPlayerProps) {
  const { t } = useI18n();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showTranscript, setShowTranscript] = useState(false);

  const speeds = [0.75, 1, 1.25, 1.5, 1.75, 2];

  return (
    <div className={`rounded-lg border border-brand-grey-light bg-white p-4 ${className}`}>
      <div className="flex gap-4 flex-col sm:flex-row">
        {thumbnailUrl && (
          <div className="flex-shrink-0">
            <img
              src={thumbnailUrl}
              alt={title || "Podcast cover"}
              className="w-full sm:w-48 h-48 object-cover rounded-lg"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          {title && (
            <h3 className="text-brand-grey-dark font-semibold mb-3">{title}</h3>
          )}
          <audio
            ref={audioRef}
            src={audioUrl}
            controls
            className="w-full"
            onTimeUpdate={(e) => onTimeUpdate?.(e.currentTarget.currentTime)}
          />
        </div>
      </div>
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
        {transcriptUrl && (
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="ml-auto text-brand-purple text-sm font-medium"
          >
            {showTranscript ? t("podcast.hideTranscript") : t("podcast.showTranscript")}
          </button>
        )}
      </div>
      {showTranscript && transcriptUrl && (
        <iframe
          src={transcriptUrl}
          title="Transcript"
          className="w-full h-48 mt-3 rounded border border-brand-grey-light"
        />
      )}
    </div>
  );
}
