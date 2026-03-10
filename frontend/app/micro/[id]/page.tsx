"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useUser } from "@/lib/use-user";
import { apiFetch } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type MicroItem = {
  id: string;
  title: string;
  type: string;
  metadata?: string | Record<string, unknown>;
  mediaId?: string;
  durationMinutes?: number;
  likeCount?: number;
  commentCount?: number;
  likedByMe?: boolean;
};

function parseMetadata(meta: string | Record<string, unknown> | undefined): Record<string, unknown> {
  if (!meta) return {};
  try {
    return typeof meta === "string" ? JSON.parse(meta || "{}") : meta;
  } catch {
    return {};
  }
}

function getVideoUrl(item: MicroItem): string | null {
  const meta = parseMetadata(item.metadata);
  const hlsUrl = meta?.hlsUrl as string | undefined;
  const videoUrl = meta?.videoUrl as string | undefined;
  return hlsUrl || videoUrl || item.mediaId || null;
}

function VideoCard({
  item,
  isActive,
  muted,
}: {
  item: MicroItem;
  isActive: boolean;
  muted: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoUrl = getVideoUrl(item);

  useEffect(() => {
    if (isActive && videoRef.current) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current?.pause();
    }
  }, [isActive]);

  if (!videoUrl) return null;

  return (
    <div className="relative w-full h-screen flex-shrink-0 snap-start bg-black">
      <video
        ref={videoRef}
        src={videoUrl}
        className="absolute inset-0 w-full h-full object-cover"
        loop
        muted={muted}
        playsInline
        onClick={() => {
          if (videoRef.current?.paused) videoRef.current.play();
          else videoRef.current?.pause();
        }}
      />
      {/* Bottom - title overlay */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-4 pb-24 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
        <h2 className="text-white font-semibold text-lg">{item.title}</h2>
        {item.durationMinutes && (
          <p className="text-white/80 text-sm mt-1">{item.durationMinutes} min</p>
        )}
      </div>
    </div>
  );
}

export default function MicroPlayerPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { user } = useUser();
  const userId = user?.id ?? "anonymous";
  const [items, setItems] = useState<MicroItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [comments, setComments] = useState<{ id: string; body: string }[]>([]);
  const [muted, setMuted] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [itemStates, setItemStates] = useState<Record<string, { liked: boolean; likeCount: number; commentCount: number; saved: boolean }>>({});
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const activeItem = items[activeIndex];

  const initialIdRef = useRef(id);

  useEffect(() => {
    const targetId = initialIdRef.current;
    fetch(`${API}/microlearning/feed?userId=${userId}&limit=50&offset=0`)
      .then((r) => r.json())
      .then((data: MicroItem[]) => {
        const arr = Array.isArray(data) ? data : [];
        if (arr.length > 0) {
          setItems(arr);
          const idx = arr.findIndex((c) => c.id === targetId);
          setActiveIndex(idx >= 0 ? idx : 0);
          const states: Record<string, { liked: boolean; likeCount: number; commentCount: number; saved: boolean }> = {};
          arr.forEach((c) => {
            states[c.id] = {
              liked: c.likedByMe ?? false,
              likeCount: c.likeCount ?? 0,
              commentCount: c.commentCount ?? 0,
              saved: false,
            };
          });
          setItemStates(states);
        } else {
          setItems([]);
        }
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    if (items.length > 0 && scrollRef.current) {
      scrollRef.current.scrollTo({ top: activeIndex * window.innerHeight, behavior: "auto" });
    }
  }, [items.length, activeIndex]);

  useEffect(() => {
    if (commentsOpen && activeItem) {
      apiFetch(`/microlearning/${activeItem.id}/comments`)
        .then((r) => r.json())
        .then((data) => setComments(Array.isArray(data) ? data : []))
        .catch(() => setComments([]));
    }
  }, [commentsOpen, activeItem?.id]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const scrollTop = scrollRef.current.scrollTop;
    const vh = window.innerHeight;
    const newIndex = Math.round(scrollTop / vh);
    if (newIndex >= 0 && newIndex < items.length && newIndex !== activeIndex) {
      setActiveIndex(newIndex);
      router.replace(`/micro/${items[newIndex].id}`, { scroll: false });
    }
  }, [items, activeIndex, router]);

  const handleLike = async () => {
    if (!activeItem) return;
    if (userId === "anonymous") {
      setAuthModalOpen(true);
      return;
    }
    try {
      const res = await apiFetch(`/microlearning/${activeItem.id}/like`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      const newLiked = data.liked ?? !itemStates[activeItem.id]?.liked;
      setItemStates((prev) => ({
        ...prev,
        [activeItem.id]: {
          ...prev[activeItem.id],
          liked: newLiked,
          likeCount: (prev[activeItem.id]?.likeCount ?? 0) + (newLiked ? 1 : -1),
          commentCount: prev[activeItem.id]?.commentCount ?? 0,
          saved: prev[activeItem.id]?.saved ?? false,
        },
      }));
    } catch {}
  };

  const handleComment = () => {
    if (userId === "anonymous") {
      setAuthModalOpen(true);
      return;
    }
    setCommentsOpen(true);
  };

  const handleShare = async () => {
    if (!activeItem) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: activeItem.title,
          text: `Check out this microlearning: ${activeItem.title}`,
          url: `${window.location.origin}/micro/${activeItem.id}`,
        });
        if (userId !== "anonymous") {
          await fetch(`${API}/microlearning/${activeItem.id}/share`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId }),
          });
        }
      } else {
        await navigator.clipboard.writeText(`${window.location.origin}/micro/${activeItem.id}`);
        alert("Link copied!");
      }
    } catch {}
  };

  const handleSave = () => {
    if (!activeItem) return;
    setItemStates((prev) => ({
      ...prev,
      [activeItem.id]: {
        ...prev[activeItem.id],
        saved: !prev[activeItem.id]?.saved,
      },
    }));
  };

  const submitComment = async () => {
    if (!newComment.trim() || userId === "anonymous" || !activeItem) return;
    try {
      const res = await apiFetch(`/microlearning/${activeItem.id}/comments`, {
        method: "POST",
        body: JSON.stringify({ userId, body: newComment.trim() }),
      });
      const comment = await res.json();
      setComments((prev) => [{ id: comment.id, body: comment.body }, ...prev]);
      setNewComment("");
      setItemStates((prev) => {
        const cur = prev[activeItem.id];
        return {
          ...prev,
          [activeItem.id]: {
            liked: cur?.liked ?? false,
            likeCount: cur?.likeCount ?? 0,
            commentCount: (cur?.commentCount ?? 0) + 1,
            saved: cur?.saved ?? false,
          },
        };
      });
    } catch {}
  };

  const getItemState = (item: MicroItem) => ({
    liked: itemStates[item.id]?.liked ?? item.likedByMe ?? false,
    likeCount: itemStates[item.id]?.likeCount ?? item.likeCount ?? 0,
    commentCount: itemStates[item.id]?.commentCount ?? item.commentCount ?? 0,
    saved: itemStates[item.id]?.saved ?? false,
  });

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white border-t-transparent" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-white p-6">
        <p className="text-lg mb-4">No videos found</p>
        <Link href="/" className="text-[#059669] font-semibold underline">
          Back to home
        </Link>
      </div>
    );
  }

  const state = activeItem ? getItemState(activeItem) : null;

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Scrollable feed - swipe up/down */}
      <div
        ref={scrollRef}
        className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide overscroll-y-contain"
        onScroll={handleScroll}
        style={{ scrollSnapType: "y mandatory", WebkitOverflowScrolling: "touch" }}
      >
        {items.map((item, index) => (
          <VideoCard
            key={item.id}
            item={item}
            isActive={index === activeIndex}
            muted={muted}
          />
        ))}
      </div>

      {/* Fixed overlay - buttons OUTSIDE scroll, always clickable */}
      <div className="fixed inset-0 pointer-events-none z-30">
        <div className="absolute top-4 left-4 pointer-events-auto">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-black/60 transition"
            aria-label="Back"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
        <div className="absolute right-4 bottom-32 flex flex-col items-center gap-4 pointer-events-auto">
          <button type="button" onClick={() => setMuted((m) => !m)} className="flex flex-col items-center gap-1 text-white p-3 min-w-[56px] min-h-[56px] justify-center rounded-lg hover:bg-white/10 transition cursor-pointer">
            <span className="text-3xl">{muted ? "🔇" : "🔊"}</span>
          </button>
          <button type="button" onClick={handleLike} className="flex flex-col items-center gap-1 text-white p-3 min-w-[56px] min-h-[56px] justify-center rounded-lg hover:bg-white/10 transition cursor-pointer">
            <span className="text-3xl">{state?.liked ? "❤️" : "🤍"}</span>
            <span className="text-xs font-medium">{state?.likeCount ?? 0}</span>
          </button>
          <button type="button" onClick={handleComment} className="flex flex-col items-center gap-1 text-white p-3 min-w-[56px] min-h-[56px] justify-center rounded-lg hover:bg-white/10 transition cursor-pointer">
            <span className="text-3xl">💬</span>
            <span className="text-xs font-medium">{state?.commentCount ?? 0}</span>
          </button>
          <button type="button" onClick={handleShare} className="flex flex-col items-center gap-1 text-white p-3 min-w-[56px] min-h-[56px] justify-center rounded-lg hover:bg-white/10 transition cursor-pointer">
            <span className="text-3xl">↗️</span>
            <span className="text-xs font-medium">Share</span>
          </button>
          <button type="button" onClick={handleSave} className="flex flex-col items-center gap-1 text-white p-3 min-w-[56px] min-h-[56px] justify-center rounded-lg hover:bg-white/10 transition cursor-pointer">
            <span className="text-3xl">{state?.saved ? "🔖" : "📑"}</span>
            <span className="text-xs font-medium">Save</span>
          </button>
        </div>
      </div>

      {/* Comments panel */}
      {commentsOpen && activeItem && (
        <div className="absolute inset-0 z-20 bg-black/90 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-white/20">
            <h3 className="text-white font-semibold">Comments</h3>
            <button onClick={() => setCommentsOpen(false)} className="text-white text-sm font-medium">
              Close
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {comments.map((c) => (
              <p key={c.id} className="text-white text-sm">{c.body}</p>
            ))}
          </div>
          {userId !== "anonymous" && (
            <div className="p-4 border-t border-white/20 flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 bg-white/10 rounded-lg px-4 py-2 text-white placeholder-white/50"
              />
              <button
                onClick={submitComment}
                disabled={!newComment.trim()}
                className="px-4 py-2 rounded-lg bg-[#059669] text-white font-medium disabled:opacity-50"
              >
                Send
              </button>
            </div>
          )}
        </div>
      )}

      {/* Auth prompt modal - sign in to like/comment */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
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
    </div>
  );
}
