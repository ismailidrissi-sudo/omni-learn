'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import 'video.js/dist/video-js.css';
import '@/styles/videojs-omnilearn.css';
import { VIDEOJS_DEFAULT_OPTIONS, COMPLETION_CONFIG } from '@/lib/videojs/config';
import { inferVideoJsMimeType } from '@/lib/videojs/infer-source-type';
import { apiFetch } from '@/lib/api';
import { absolutePlaybackUrl } from '@/lib/video-playback-url';
import { CompletionBadge } from './CompletionBadge';

export interface WatchProgress {
  watchedSeconds: number;
  totalDuration: number;
  furthestPosition: number;
  watchPercentage: number;
  isCompleted: boolean;
  lastPosition: number;
  seekCount: number;
  pauseCount: number;
  playCount: number;
}

interface OmniLearnPlayerProps {
  streamEndpoint: string;
  contentId: string;
  userId?: string;
  onProgressUpdate?: (progress: WatchProgress) => void;
  onComplete?: (contentId: string) => void;
  onEnded?: () => void;
  initialPosition?: number;
  className?: string;
  poster?: string;
  autoplay?: boolean;
  allowSeeking?: boolean;
  allowSpeedChange?: boolean;
  requireFullWatch?: boolean;
}

export default function OmniLearnPlayer({
  streamEndpoint,
  contentId,
  userId,
  onProgressUpdate,
  onComplete,
  onEnded,
  initialPosition = 0,
  className = '',
  poster,
  autoplay = false,
  allowSeeking = true,
  allowSpeedChange = true,
  requireFullWatch = false,
}: OmniLearnPlayerProps) {
  const videoRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);
  const [completed, setCompleted] = useState(false);

  const progressRef = useRef<WatchProgress>({
    watchedSeconds: 0,
    totalDuration: 0,
    furthestPosition: 0,
    watchPercentage: 0,
    isCompleted: false,
    lastPosition: 0,
    seekCount: 0,
    pauseCount: 0,
    playCount: 0,
  });
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSyncTimeRef = useRef<number>(0);
  const watchedIntervalsRef = useRef<Array<[number, number]>>([]);
  const lastTimeRef = useRef<number>(0);

  const mergeInterval = useCallback((start: number, end: number) => {
    const intervals = watchedIntervalsRef.current;
    const newInterval: [number, number] = [Math.floor(start), Math.ceil(end)];
    const merged: Array<[number, number]> = [];
    let added = false;

    for (const existing of intervals) {
      if (newInterval[1] < existing[0] - 1) {
        if (!added) {
          merged.push(newInterval);
          added = true;
        }
        merged.push(existing);
      } else if (newInterval[0] > existing[1] + 1) {
        merged.push(existing);
      } else {
        newInterval[0] = Math.min(newInterval[0], existing[0]);
        newInterval[1] = Math.max(newInterval[1], existing[1]);
      }
    }
    if (!added) merged.push(newInterval);

    watchedIntervalsRef.current = merged;
    return merged.reduce((total, [s, e]) => total + (e - s), 0);
  }, []);

  const syncProgress = useCallback(
    async (force = false) => {
      if (!userId) return;
      const now = Date.now();
      if (
        !force &&
        now - lastSyncTimeRef.current <
          COMPLETION_CONFIG.SYNC_INTERVAL_SECONDS * 1000
      ) {
        return;
      }
      lastSyncTimeRef.current = now;

      const progress = progressRef.current;

      try {
        await apiFetch('/video/progress', {
          method: 'POST',
          body: JSON.stringify({
            userId,
            contentId,
            watchedSeconds: progress.watchedSeconds,
            totalDurationSeconds: progress.totalDuration,
            furthestPositionSeconds: progress.furthestPosition,
            watchPercentage: progress.watchPercentage,
            isCompleted: progress.isCompleted,
            lastPositionSeconds: progress.lastPosition,
            seekCount: progress.seekCount,
            pauseCount: progress.pauseCount,
            playCount: progress.playCount,
            watchedIntervals: watchedIntervalsRef.current,
          }),
        });
      } catch (err) {
        console.error('[OmniLearn] Failed to sync progress:', err);
      }
    },
    [userId, contentId],
  );

  useEffect(() => {
    if (!videoRef.current) return;

    const videoElement = document.createElement('video-js');
    videoElement.classList.add('vjs-big-play-centered', 'vjs-omnilearn');
    if (!allowSeeking) videoElement.classList.add('vjs-seeking-disabled');
    videoRef.current.appendChild(videoElement);

    const playUrl = absolutePlaybackUrl(streamEndpoint);

    const options: Record<string, unknown> = {
      ...VIDEOJS_DEFAULT_OPTIONS,
      autoplay,
      poster,
      sources: [
        {
          src: playUrl,
          type: inferVideoJsMimeType(playUrl),
        },
      ],
    };

    if (!allowSpeedChange) {
      options.playbackRates = [1];
      const existingControlBar =
        typeof options.controlBar === 'object' && options.controlBar !== null
          ? options.controlBar
          : {};
      options.controlBar = {
        ...(existingControlBar as Record<string, unknown>),
        playbackRateMenuButton: false,
      };
    }

    const player = videojs(videoElement, options, () => {
      if (initialPosition > 0) {
        player.currentTime(initialPosition);
      }
    });

    playerRef.current = player;

    player.on('timeupdate', () => {
      const currentTime = player.currentTime() || 0;
      const duration = player.duration() || 0;
      if (duration <= 0) return;

      const timeDelta = currentTime - lastTimeRef.current;
      if (timeDelta > 0 && timeDelta < 2) {
        const uniqueWatched = mergeInterval(lastTimeRef.current, currentTime);
        progressRef.current.watchedSeconds = uniqueWatched;
      }
      lastTimeRef.current = currentTime;

      progressRef.current.totalDuration = duration;
      progressRef.current.lastPosition = currentTime;
      progressRef.current.furthestPosition = Math.max(
        progressRef.current.furthestPosition,
        currentTime,
      );

      const threshold = requireFullWatch
        ? 1.0
        : COMPLETION_CONFIG.COMPLETION_THRESHOLD;
      progressRef.current.watchPercentage =
        progressRef.current.watchedSeconds / duration;

      if (
        !progressRef.current.isCompleted &&
        progressRef.current.watchPercentage >= threshold
      ) {
        progressRef.current.isCompleted = true;
        setCompleted(true);
        onComplete?.(contentId);
        syncProgress(true);
      }

      onProgressUpdate?.({ ...progressRef.current });
    });

    player.on('seeking', () => {
      if (!allowSeeking) {
        const furthest = progressRef.current.furthestPosition;
        const attempted = player.currentTime() || 0;
        if (attempted > furthest + 2) {
          player.currentTime(furthest);
          return;
        }
      }
      progressRef.current.seekCount++;
    });

    player.on('play', () => {
      progressRef.current.playCount++;
    });

    player.on('pause', () => {
      progressRef.current.pauseCount++;
      syncProgress(true);
    });

    player.on('ended', () => {
      syncProgress(true);
      onEnded?.();
    });

    syncTimerRef.current = setInterval(() => {
      if (!player.paused()) {
        syncProgress();
      }
    }, COMPLETION_CONFIG.SYNC_INTERVAL_SECONDS * 1000);

    const handleVisibility = () => {
      if (document.hidden) {
        player.pause();
        syncProgress(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
      syncProgress(true);
      if (playerRef.current && !playerRef.current.isDisposed()) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamEndpoint]);

  return (
    <div
      data-vjs-player
      className={`relative overflow-hidden rounded-none sm:rounded-lg ${className}`}
    >
      <CompletionBadge visible={completed} />
      <div ref={videoRef} />
    </div>
  );
}
