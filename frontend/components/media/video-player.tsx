'use client';

/**
 * VideoPlayer — Thin wrapper around OmniLearnPlayer for backwards compatibility.
 * All video playback now uses Video.js via OmniLearnPlayer.
 * omnilearn.space | Afflatus Consulting Group
 */

import dynamic from 'next/dynamic';

const OmniLearnPlayer = dynamic(
  () => import('@/components/video/OmniLearnPlayer'),
  { ssr: false },
);

interface VideoPlayerProps {
  src: string;
  hlsUrl?: string;
  poster?: string;
  className?: string;
  onTimeUpdate?: (currentTime: number) => void;
  onEnded?: () => void;
}

export function VideoPlayer({
  src,
  hlsUrl,
  poster,
  className = '',
  onTimeUpdate,
  onEnded,
}: VideoPlayerProps) {
  return (
    <OmniLearnPlayer
      streamEndpoint={hlsUrl || src}
      contentId=""
      poster={poster}
      className={className}
      onEnded={onEnded}
      onProgressUpdate={
        onTimeUpdate ? (p) => onTimeUpdate(p.lastPosition) : undefined
      }
    />
  );
}
