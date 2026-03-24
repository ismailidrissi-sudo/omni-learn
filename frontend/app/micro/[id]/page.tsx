'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useUser } from '@/lib/use-user';
import { apiFetch, API_URL } from '@/lib/api';
import { detectProvider } from '@/lib/video-provider';
import { toast } from '@/lib/use-toast';
import { absoluteLearnerUrlWithReferral } from '@/lib/referral-share-url';
import dynamic from 'next/dynamic';
import type { MicrolearningItem } from '@/components/video/MicrolearningReels';

const MicrolearningReels = dynamic(
  () => import('@/components/video/MicrolearningReels'),
  { ssr: false },
);

type MicroItem = {
  id: string;
  title: string;
  description?: string;
  type: string;
  metadata?: string | Record<string, unknown>;
  mediaId?: string;
  durationMinutes?: number;
  likeCount?: number;
  commentCount?: number;
  likedByMe?: boolean;
  /** Set after feed load when URL needs server-side resolution (e.g. YouTube). */
  resolvedStreamUrl?: string;
};

function parseMetadata(
  meta: string | Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!meta) return {};
  try {
    return typeof meta === 'string' ? JSON.parse(meta || '{}') : meta;
  } catch {
    return {};
  }
}

function getVideoUrl(item: MicroItem): string {
  const meta = parseMetadata(item.metadata);
  const hlsUrl = meta?.hlsUrl as string | undefined;
  const videoUrl = meta?.videoUrl as string | undefined;
  return hlsUrl || videoUrl || item.mediaId || '';
}

async function resolveStreamIfNeeded(raw: string): Promise<string> {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (!detectProvider(trimmed).requiresResolution) return trimmed;
  try {
    const res = await apiFetch('/video/resolve', {
      method: 'POST',
      body: JSON.stringify({ url: trimmed }),
    });
    if (!res.ok) return trimmed;
    const data = (await res.json()) as { streamEndpoint?: string };
    const endpoint = data.streamEndpoint?.trim() || '';
    if (!endpoint) return trimmed;
    if (endpoint.startsWith('/') && !endpoint.startsWith('//')) {
      return `${API_URL}${endpoint}`;
    }
    return endpoint;
  } catch {
    return trimmed;
  }
}

export default function MicroPlayerPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { user } = useUser();
  const userId = user?.id ?? 'anonymous';
  const [items, setItems] = useState<MicroItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [initialIndex, setInitialIndex] = useState(0);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  useEffect(() => {
    if (!id || typeof id !== 'string' || !id.trim()) {
      setLoading(false);
      setError('Invalid link');
      return;
    }

    setLoading(true);
    setError('');
    const targetId = id.trim();
    const seed = encodeURIComponent(targetId);

    const abortController = new AbortController();
    const abortTimer = window.setTimeout(() => abortController.abort(), 22_000);

    apiFetch(
      `/microlearning/feed?userId=${encodeURIComponent(userId)}&limit=50&offset=0&seed=${seed}`,
      { signal: abortController.signal },
    )
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(`HTTP ${r.status}`);
        }
        return r.json() as Promise<MicroItem[]>;
      })
      .then((data: MicroItem[]) => {
        const arr = Array.isArray(data) ? data : [];
        if (arr.length === 0) {
          setItems([]);
          return;
        }
        const idx = arr.findIndex((c) => c.id === targetId);
        setInitialIndex(idx >= 0 ? idx : 0);
        setItems(arr);

        /** Resolve stream URLs in background with per-item timeout so mobile never hangs on /video/resolve */
        void (async () => {
          const pairs = await Promise.all(
            arr.map((c) => {
              const raw = getVideoUrl(c);
              return Promise.race([
                resolveStreamIfNeeded(raw).then((resolved) => ({ id: c.id, resolved })),
                new Promise<{ id: string; resolved: string }>((resolve) =>
                  setTimeout(() => resolve({ id: c.id, resolved: raw }), 6500),
                ),
              ]);
            }),
          );
          const map = new Map(pairs.map((p) => [p.id, p.resolved]));
          setItems((prev) =>
            prev.map((p) => {
              const resolved = map.get(p.id);
              return resolved !== undefined ? { ...p, resolvedStreamUrl: resolved } : p;
            }),
          );
        })();
      })
      .catch(() => setError('Content not found'))
      .finally(() => {
        window.clearTimeout(abortTimer);
        setLoading(false);
      });
  }, [userId, id]);

  const reelsItems: MicrolearningItem[] = items.map((item) => ({
    id: item.id,
    contentId: item.id,
    streamEndpoint: item.resolvedStreamUrl ?? getVideoUrl(item),
    sourceUrl: getVideoUrl(item),
    title: item.title,
    description: item.description || '',
    authorName: '',
    authorAvatar: '',
    thumbnail: '',
    duration: (item.durationMinutes ?? 0) * 60,
    likeCount: item.likeCount ?? 0,
    commentCount: item.commentCount ?? 0,
    isLiked: item.likedByMe ?? false,
    isSaved: false,
  }));

  const handleLike = useCallback(
    async (contentId: string, _liked?: boolean) => {
      if (userId === 'anonymous') {
        setAuthModalOpen(true);
        return;
      }
      await apiFetch(`/microlearning/${contentId}/like`, {
        method: 'POST',
        body: JSON.stringify({ userId }),
      });
    },
    [userId],
  );

  const handleComment = useCallback(
    async (contentId: string, text: string) => {
      if (userId === 'anonymous') {
        setAuthModalOpen(true);
        return null;
      }
      const res = await apiFetch(`/microlearning/${contentId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ userId, body: text }),
      });
      return res.json();
    },
    [userId],
  );

  const handleShare = useCallback(
    async (contentId: string) => {
      let referralCode: string | null = null;
      if (userId !== 'anonymous') {
        try {
          const r = await apiFetch('/referral/share-code');
          if (r.ok) {
            const d = (await r.json()) as { code?: string };
            referralCode = d.code ?? null;
          }
        } catch {
          /* ignore */
        }
      }
      const shareUrl = absoluteLearnerUrlWithReferral(`/micro/${contentId}`, referralCode);
      try {
        if (navigator.share) {
          await navigator.share({
            title: 'OmniLearn Microlearning',
            url: shareUrl,
          });
          if (userId !== 'anonymous') {
            await apiFetch(`/microlearning/${contentId}/share`, {
              method: 'POST',
              body: JSON.stringify({ userId }),
            });
          }
        } else {
          await navigator.clipboard.writeText(shareUrl);
          toast('Link copied!', 'success');
        }
      } catch {}
    },
    [userId],
  );

  const handleLoadComments = useCallback(async (contentId: string) => {
    const res = await apiFetch(`/microlearning/${contentId}/comments`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-white p-6">
        <p className="text-lg mb-4">{error}</p>
        <Link href="/" className="text-[#059669] font-semibold underline">
          Back to home
        </Link>
      </div>
    );
  }

  if (reelsItems.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-white p-6">
        <p className="text-lg mb-4">No videos found</p>
        <Link href="/" className="text-[#059669] font-semibold underline">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <>
      <MicrolearningReels
        items={reelsItems}
        initialIndex={initialIndex}
        userId={userId}
        onClose={() => router.back()}
        onLike={handleLike}
        onComment={handleComment}
        onShare={handleShare}
        onLoadComments={handleLoadComments}
      />

      {/* Auth prompt modal */}
      {authModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-sm w-full shadow-xl border border-white/10">
            <h3 className="text-lg font-bold text-white">Sign in to continue</h3>
            <p className="mt-2 text-gray-400">
              Sign in to like videos and add comments.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Link
                href="/signin"
                className="block text-center rounded-lg bg-[#059669] px-4 py-3 text-white font-semibold hover:opacity-90"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="block text-center rounded-lg border border-[#059669] px-4 py-3 text-[#059669] font-semibold hover:bg-[#059669]/10"
              >
                Create account
              </Link>
              <button
                onClick={() => setAuthModalOpen(false)}
                className="text-gray-500 text-sm py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
