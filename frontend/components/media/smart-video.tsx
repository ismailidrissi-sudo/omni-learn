'use client';

import { useMemo, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { detectProvider, isExternalProvider } from '@/lib/video-provider';
import { useI18n } from '@/lib/i18n/context';
import { apiFetch } from '@/lib/api';
import type { WatchProgress } from '@/components/video/OmniLearnPlayer';

const OmniLearnPlayer = dynamic(
  () => import('@/components/video/OmniLearnPlayer'),
  { ssr: false },
);

interface SmartVideoProps {
  src: string;
  hlsUrl?: string;
  poster?: string;
  title?: string;
  className?: string;
  adsEnabled?: boolean;
  contentId?: string;
  userId?: string;
  onTimeUpdate?: (currentTime: number) => void;
  onEnded?: () => void;
  onComplete?: (contentId: string) => void;
  onProgressUpdate?: (progress: WatchProgress) => void;
  initialPosition?: number;
  allowSeeking?: boolean;
  allowSpeedChange?: boolean;
  requireFullWatch?: boolean;
}

function AdBanner() {
  const { t } = useI18n();
  return (
    <div
      className="flex items-center justify-center py-3 px-4 text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-b-lg border-t border-gray-200 dark:border-gray-700"
      style={{ minHeight: 50 }}
    >
      <span className="opacity-75">{t('media.advertisement')}</span>
      <span className="mx-2">&middot;</span>
      <span className="opacity-75">{t('media.upgradeToRemoveAds')}</span>
    </div>
  );
}

export function SmartVideo({
  src,
  hlsUrl,
  poster,
  title: _title,
  className = '',
  adsEnabled = false,
  contentId,
  userId,
  onTimeUpdate,
  onEnded,
  onComplete,
  onProgressUpdate,
  initialPosition,
  allowSeeking,
  allowSpeedChange,
  requireFullWatch,
}: SmartVideoProps) {
  const detected = useMemo(() => detectProvider(src), [src]);
  const [resolvedEndpoint, setResolvedEndpoint] = useState<string | null>(null);
  const [resolvedPoster, setResolvedPoster] = useState<string | undefined>(poster);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState('');

  useEffect(() => {
    if (detected.requiresResolution) {
      setResolving(true);
      setResolveError('');
      apiFetch('/video/resolve', {
        method: 'POST',
        body: JSON.stringify({ url: src }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Failed to resolve video');
          }
          return res.json();
        })
        .then((data) => {
          setResolvedEndpoint(data.streamEndpoint);
          if (data.thumbnail && !poster) {
            setResolvedPoster(`/video/thumbnail/${data.videoId}`);
          }
        })
        .catch((err) => {
          setResolveError(err.message || 'Video unavailable');
        })
        .finally(() => setResolving(false));
    }
  }, [src, detected.requiresResolution, poster]);

  if (detected.requiresResolution) {
    if (resolving) {
      return (
        <div
          className={`overflow-hidden rounded-none sm:rounded-lg bg-black flex items-center justify-center ${className}`}
          style={{ aspectRatio: '16/9' }}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <p className="text-white/60 text-sm">Loading video...</p>
          </div>
        </div>
      );
    }

    if (resolveError) {
      return (
        <div
          className={`overflow-hidden rounded-none sm:rounded-lg bg-gray-900 flex items-center justify-center ${className}`}
          style={{ aspectRatio: '16/9' }}
        >
          <div className="text-center p-6">
            <p className="text-white/80 text-sm">{resolveError}</p>
            <p className="text-white/40 text-xs mt-2">
              This video could not be loaded. It may be private, restricted, or unavailable.
            </p>
          </div>
        </div>
      );
    }

    if (resolvedEndpoint) {
      return (
        <div>
          <OmniLearnPlayer
            streamEndpoint={resolvedEndpoint}
            contentId={contentId || detected.videoId}
            userId={userId}
            poster={resolvedPoster}
            className={className}
            onEnded={onEnded}
            onComplete={onComplete}
            onProgressUpdate={(p) => {
              onTimeUpdate?.(p.lastPosition);
              onProgressUpdate?.(p);
            }}
            initialPosition={initialPosition}
            allowSeeking={allowSeeking}
            allowSpeedChange={allowSpeedChange}
            requireFullWatch={requireFullWatch}
          />
          {adsEnabled && <AdBanner />}
        </div>
      );
    }
  }

  if (isExternalProvider(detected.provider)) {
    // Vimeo, Dailymotion, Wistia — use OmniLearnPlayer with embed URL as src
    // For now these still go through direct playback since we don't proxy them
    return (
      <div>
        <OmniLearnPlayer
          streamEndpoint={hlsUrl || src}
          contentId={contentId || ''}
          userId={userId}
          poster={poster}
          className={className}
          onEnded={onEnded}
          onComplete={onComplete}
          onProgressUpdate={(p) => {
            onTimeUpdate?.(p.lastPosition);
            onProgressUpdate?.(p);
          }}
          initialPosition={initialPosition}
          allowSeeking={allowSeeking}
          allowSpeedChange={allowSpeedChange}
          requireFullWatch={requireFullWatch}
        />
        {adsEnabled && <AdBanner />}
      </div>
    );
  }

  // Direct URL — use OmniLearnPlayer
  return (
    <div>
      <OmniLearnPlayer
        streamEndpoint={hlsUrl || src}
        contentId={contentId || ''}
        userId={userId}
        poster={poster}
        className={className}
        onEnded={onEnded}
        onComplete={onComplete}
        onProgressUpdate={(p) => {
          onTimeUpdate?.(p.lastPosition);
          onProgressUpdate?.(p);
        }}
        initialPosition={initialPosition}
        allowSeeking={allowSeeking}
        allowSpeedChange={allowSpeedChange}
        requireFullWatch={requireFullWatch}
      />
      {adsEnabled && <AdBanner />}
    </div>
  );
}
