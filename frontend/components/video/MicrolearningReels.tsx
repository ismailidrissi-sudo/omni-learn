'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import 'video.js/dist/video-js.css';
import '@/styles/videojs-reels.css';
import { VIDEOJS_DEFAULT_OPTIONS, COMPLETION_CONFIG } from '@/lib/videojs/config';
import { inferVideoJsMimeType } from '@/lib/videojs/infer-source-type';
import { apiFetch } from '@/lib/api';
import { detectProvider } from '@/lib/video-provider';
import { absolutePlaybackUrl } from '@/lib/video-playback-url';

/**
 * If streamEndpoint is still a YouTube/Vimeo page URL (e.g. resolve timed out), we embed instead of Video.js.
 * Embeds omit mute so audio plays when the browser allows (learners open /micro via tap, which unlocks autoplay with sound on many devices).
 */
function iframeSrcForPageUrl(streamUrl: string): string | null {
  const u = streamUrl.trim();
  if (!u) return null;
  const d = detectProvider(u);
  if (d.provider === 'youtube' && d.videoId) {
    return `https://www.youtube-nocookie.com/embed/${d.videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;
  }
  if (d.provider === 'vimeo' && d.videoId) {
    return `https://player.vimeo.com/video/${d.videoId}?autoplay=1&muted=0&playsinline=1`;
  }
  if (d.provider === 'dailymotion' && d.videoId) {
    return `https://www.dailymotion.com/embed/video/${d.videoId}?autoplay=1&mute=0`;
  }
  if (d.provider === 'wistia' && d.embedUrl) {
    return `${d.embedUrl}${d.embedUrl.includes('?') ? '&' : '?'}autoplay=1`;
  }
  return null;
}

export interface MicrolearningItem {
  id: string;
  contentId: string;
  streamEndpoint: string;
  /** Original URL from content metadata (optional; reserved for future fallbacks) */
  sourceUrl?: string;
  title: string;
  description: string;
  authorName: string;
  authorAvatar: string;
  thumbnail: string;
  duration: number;
  likeCount: number;
  commentCount: number;
  isLiked: boolean;
  isSaved: boolean;
}

interface ReelsPlayerProps {
  items: MicrolearningItem[];
  initialIndex?: number;
  userId: string;
  onClose: () => void;
  onLike: (contentId: string, liked: boolean) => Promise<void>;
  onComment: (contentId: string, text: string) => Promise<unknown>;
  onShare: (contentId: string) => Promise<void>;
  onLoadComments: (contentId: string) => Promise<{ id: string; body: string; user_name?: string }[]>;
}

export default function MicrolearningReels({
  items,
  initialIndex = 0,
  userId,
  onClose,
  onLike,
  onComment,
  onShare,
  onLoadComments,
}: ReelsPlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [interactions, setInteractions] = useState<
    Record<string, { liked: boolean; saved: boolean; likeCount: number }>
  >({});
  const [progress, setProgress] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<{ id: string | number; body: string; user_name?: string }[]>([]);

  const playerRef = useRef<Player | null>(null);
  const videoRef = useRef<HTMLDivElement>(null);
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);

  const currentItem = items[currentIndex];

  /** Parent loads feed async and passes the correct initialIndex when ready — keep scroll position in sync */
  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    const initial: Record<string, { liked: boolean; saved: boolean; likeCount: number }> = {};
    items.forEach((item) => {
      initial[item.id] = {
        liked: item.isLiked,
        saved: item.isSaved,
        likeCount: item.likeCount,
      };
    });
    setInteractions(initial);
  }, [items]);

  useEffect(() => {
    if (!videoRef.current || !currentItem) return;

    const mount = videoRef.current;

    if (playerRef.current && !playerRef.current.isDisposed()) {
      playerRef.current.dispose();
      playerRef.current = null;
    }
    mount.innerHTML = '';

    const stream = (currentItem.streamEndpoint || '').trim();
    const pageEmbed = iframeSrcForPageUrl(stream);
    const absSrc = absolutePlaybackUrl(stream);

    /** YouTube/Vimeo page URLs are not playable in Video.js — use official embed (works when resolve timed out or proxy is down) */
    if (pageEmbed) {
      const iframe = document.createElement('iframe');
      iframe.src = pageEmbed;
      iframe.className = 'absolute inset-0 w-full h-full min-h-full border-0';
      iframe.setAttribute(
        'allow',
        'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share',
      );
      iframe.setAttribute('allowFullScreen', '');
      iframe.title = currentItem.title;
      mount.appendChild(iframe);
      setIsPlaying(true);
      setIsCompleted(false);
      setProgress(0);
      return () => {
        mount.innerHTML = '';
      };
    }

    if (!absSrc) {
      setIsPlaying(false);
      setProgress(0);
      return () => {
        mount.innerHTML = '';
      };
    }

    const videoElement = document.createElement('video-js');
    videoElement.classList.add('vjs-reels-player');
    mount.appendChild(videoElement);

    const player = videojs(videoElement, {
      ...VIDEOJS_DEFAULT_OPTIONS,
      controls: false,
      loop: true,
      autoplay: 'any',
      muted: false,
      playsinline: true,
      preload: 'auto',
      fluid: false,
      fill: true,
      responsive: false,
      playbackRates: [1],
      sources: [
        {
          src: absSrc,
          type: inferVideoJsMimeType(absSrc),
        },
      ],
    });

    playerRef.current = player;
    setIsCompleted(false);
    setProgress(0);

    const runAutoplay = () => {
      if (player.isDisposed()) return;
      player.muted(false);
      if (typeof player.volume === 'function') {
        player.volume(1);
      }
      void player.play()?.catch(() => {});
    };

    const onPlaying = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    player.on('playing', onPlaying);
    player.on('pause', onPause);

    player.ready(() => {
      runAutoplay();
    });
    player.one('canplay', runAutoplay);

    let watchedSeconds = 0;
    let lastTime = 0;
    let completionFired = false;

    player.on('timeupdate', () => {
      const current = player.currentTime() || 0;
      const duration = player.duration() || 0;
      if (duration <= 0) return;

      const delta = current - lastTime;
      if (delta > 0 && delta < 2) {
        watchedSeconds += delta;
      }
      lastTime = current;

      setProgress(current / duration);

      if (
        !completionFired &&
        watchedSeconds / duration >= COMPLETION_CONFIG.MICRO_COMPLETION_THRESHOLD
      ) {
        completionFired = true;
        setIsCompleted(true);
        apiFetch('/video/progress', {
          method: 'POST',
          body: JSON.stringify({
            userId,
            contentId: currentItem.contentId,
            watchedSeconds,
            totalDurationSeconds: duration,
            watchPercentage: watchedSeconds / duration,
            isCompleted: true,
            lastPositionSeconds: current,
            playCount: 1,
          }),
        }).catch(() => {});
      }
    });

    const onError = () => {
      const fallback = (currentItem.sourceUrl || '').trim();
      const fbEmbed = iframeSrcForPageUrl(fallback);
      if (!fbEmbed) return;
      try {
        if (playerRef.current && !playerRef.current.isDisposed()) {
          playerRef.current.off('playing', onPlaying);
          playerRef.current.off('pause', onPause);
          playerRef.current.off('error', onError);
          playerRef.current.dispose();
          playerRef.current = null;
        }
        mount.innerHTML = '';
        const iframe = document.createElement('iframe');
        iframe.src = fbEmbed;
        iframe.className = 'absolute inset-0 w-full h-full min-h-full border-0';
        iframe.setAttribute(
          'allow',
          'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share',
        );
        iframe.setAttribute('allowFullScreen', '');
        iframe.title = currentItem.title;
        mount.appendChild(iframe);
        setIsPlaying(true);
      } catch {
        /* keep Video.js error UI if swap fails */
      }
    };
    player.on('error', onError);

    return () => {
      if (playerRef.current && !playerRef.current.isDisposed()) {
        playerRef.current.off('playing', onPlaying);
        playerRef.current.off('pause', onPause);
        playerRef.current.off('error', onError);
        playerRef.current.dispose();
        playerRef.current = null;
      }
      mount.innerHTML = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, currentItem?.streamEndpoint, currentItem?.sourceUrl]);

  const goToNext = useCallback(() => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  }, [currentIndex, items.length]);

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

  useEffect(() => {
    const el = scrollRootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 28) return;
      e.preventDefault();
      if (e.deltaY > 0) goToNext();
      else goToPrev();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [goToNext, goToPrev]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaY = touchStartY.current - e.changedTouches[0].clientY;
    if (Math.abs(deltaY) > 80) {
      if (deltaY > 0) goToNext();
      else goToPrev();
    }
  };

  const togglePlayPause = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    if (player.paused()) {
      if (player.muted()) {
        player.muted(false);
      }
      void player.play()?.catch(() => {});
      setIsPlaying(true);
    } else {
      player.pause();
      setIsPlaying(false);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          goToPrev();
          break;
        case 'ArrowDown':
          e.preventDefault();
          goToNext();
          break;
        case ' ':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'Escape':
          onClose();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, goToPrev, onClose, togglePlayPause]);

  const handleLike = async () => {
    if (!currentItem) return;
    const current = interactions[currentItem.id] || {
      liked: false,
      likeCount: 0,
      saved: false,
    };
    const newLiked = !current.liked;

    setInteractions((prev) => ({
      ...prev,
      [currentItem.id]: {
        ...current,
        liked: newLiked,
        likeCount: current.likeCount + (newLiked ? 1 : -1),
      },
    }));

    await onLike(currentItem.contentId, newLiked);
  };

  const handleSave = () => {
    if (!currentItem) return;
    setInteractions((prev) => ({
      ...prev,
      [currentItem.id]: {
        ...prev[currentItem.id],
        saved: !prev[currentItem.id]?.saved,
      },
    }));
  };

  const handleShare = async () => {
    if (!currentItem) return;
    await onShare(currentItem.contentId);
  };

  const handleOpenComments = async () => {
    setShowComments(true);
    if (currentItem) {
      try {
        const loaded = await onLoadComments(currentItem.contentId);
        setComments(loaded);
      } catch {
        setComments([]);
      }
    }
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !currentItem) return;
    try {
      const result = await onComment(currentItem.contentId, commentText.trim());
      const comment = result as { id?: string | number } | null | undefined;
      setComments((prev) => [
        { id: comment?.id || Date.now(), body: commentText.trim(), user_name: 'You' },
        ...prev,
      ]);
      setCommentText('');
    } catch {}
  };

  const itemInteraction = interactions[currentItem?.id] || {
    liked: false,
    saved: false,
    likeCount: 0,
  };

  return (
    <div
      ref={scrollRootRef}
      className="fixed inset-0 z-50 bg-black flex items-center justify-center"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 left-4 z-50 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Video container — vertical 9:16 */}
      <div className="relative w-full h-full max-w-[480px] mx-auto overflow-hidden">
        {/* Video.js mount point */}
        <div
          ref={videoRef}
          className="absolute inset-0 w-full h-full"
          onClick={togglePlayPause}
        />

        {/* Play/Pause overlay */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="w-20 h-20 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center animate-omni-fade-in">
              <svg className="w-9 h-9 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}

        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/20 z-20">
          <div
            className="h-full bg-white transition-all duration-200"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        {/* Completion badge */}
        {isCompleted && (
          <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 bg-green-500/90 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full animate-omni-bounce-in">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            Completed
          </div>
        )}

        {/* Right side action buttons */}
        <div className="absolute right-3 bottom-32 flex flex-col items-center gap-5 z-20">
          {/* Like */}
          <button onClick={handleLike} className="flex flex-col items-center gap-1 group">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
                itemInteraction.liked
                  ? 'bg-red-500 scale-110'
                  : 'bg-black/30 backdrop-blur-sm group-hover:bg-black/50'
              }`}
            >
              <svg
                className={`w-6 h-6 transition-colors ${
                  itemInteraction.liked ? 'text-white fill-white' : 'text-white'
                }`}
                fill={itemInteraction.liked ? 'currentColor' : 'none'}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
            </div>
            <span className="text-white text-xs font-medium">
              {itemInteraction.likeCount || ''}
            </span>
          </button>

          {/* Comment */}
          <button onClick={handleOpenComments} className="flex flex-col items-center gap-1 group">
            <div className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center group-hover:bg-black/50 transition-colors">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <span className="text-white text-xs font-medium">
              {currentItem?.commentCount || ''}
            </span>
          </button>

          {/* Share — grouped with like & comment as primary social actions */}
          <button onClick={handleShare} className="flex flex-col items-center gap-1 group">
            <div className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center group-hover:bg-black/50 transition-colors">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
            </div>
            <span className="text-white text-xs font-medium">Share</span>
          </button>

          {/* Save */}
          <button onClick={handleSave} className="flex flex-col items-center gap-1 group">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
                itemInteraction.saved
                  ? 'bg-yellow-500 scale-110'
                  : 'bg-black/30 backdrop-blur-sm group-hover:bg-black/50'
              }`}
            >
              <svg
                className={`w-6 h-6 transition-colors ${
                  itemInteraction.saved ? 'text-white fill-white' : 'text-white'
                }`}
                fill={itemInteraction.saved ? 'currentColor' : 'none'}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                />
              </svg>
            </div>
            <span className="text-white text-xs font-medium">Save</span>
          </button>
        </div>

        {/* Bottom info overlay */}
        <div className="absolute bottom-0 left-0 right-16 p-4 z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
          {currentItem?.authorAvatar && (
            <div className="flex items-center gap-3 mb-3">
              <Image
                src={currentItem.authorAvatar}
                alt={currentItem.authorName || ''}
                width={40}
                height={40}
                className="rounded-full border-2 border-white object-cover"
              />
              <span className="text-white font-semibold text-sm">
                {currentItem.authorName}
              </span>
            </div>
          )}
          <h3 className="text-white font-bold text-base mb-1">
            {currentItem?.title}
          </h3>
          {currentItem?.description && (
            <p className="text-white/80 text-sm line-clamp-2">
              {currentItem.description}
            </p>
          )}
        </div>

        {/* Navigation arrows (desktop) */}
        {currentIndex > 0 && (
          <button
            onClick={goToPrev}
            className="absolute top-1/3 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-black/20 backdrop-blur-sm items-center justify-center text-white/60 hover:text-white hover:bg-black/40 transition-all z-20 hidden md:flex"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
        )}
        {currentIndex < items.length - 1 && (
          <button
            onClick={goToNext}
            className="absolute bottom-1/3 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-black/20 backdrop-blur-sm items-center justify-center text-white/60 hover:text-white hover:bg-black/40 transition-all z-20 hidden md:flex"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Comments panel (slide-up) */}
      {showComments && (
        <div className="absolute bottom-0 left-0 right-0 max-w-[480px] mx-auto bg-gray-900/95 backdrop-blur-xl rounded-t-2xl z-[60] max-h-[60vh] flex flex-col animate-omni-slide-up">
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h4 className="text-white font-semibold">
              Comments ({currentItem?.commentCount || 0})
            </h4>
            <button
              onClick={() => setShowComments(false)}
              className="text-white/60 hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-700 flex-shrink-0" />
                <div>
                  <span className="text-white text-sm font-medium">
                    {comment.user_name || 'User'}
                  </span>
                  <p className="text-white/80 text-sm">{comment.body}</p>
                </div>
              </div>
            ))}
            {comments.length === 0 && (
              <p className="text-white/40 text-sm text-center py-8">
                No comments yet. Be the first!
              </p>
            )}
          </div>

          <div className="p-4 border-t border-white/10 flex gap-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmitComment()}
              placeholder="Add a comment..."
              className="flex-1 bg-white/10 text-white rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-white/40"
            />
            <button
              onClick={handleSubmitComment}
              disabled={!commentText.trim()}
              className="px-4 py-2 bg-indigo-500 text-white rounded-full text-sm font-medium disabled:opacity-40 hover:bg-indigo-400 transition"
            >
              Post
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
