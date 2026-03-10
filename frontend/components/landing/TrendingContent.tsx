"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useUser } from "@/lib/use-user";

type MicroItem = {
  id: string;
  title: string;
  type: string;
  metadata?: string | Record<string, unknown>;
  mediaId?: string;
  durationMinutes?: number;
};

type CourseItem = {
  id: string;
  title: string;
  type: string;
  durationMinutes?: number;
  description?: string;
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

async function fetchTrendingMicro(limit = 4): Promise<MicroItem[]> {
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  const res = await fetch(`${base}/microlearning/feed?userId=anonymous&limit=${limit}&offset=0`, { cache: "no-store" });
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function fetchTrendingCourses(limit = 3): Promise<CourseItem[]> {
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  const res = await fetch(`${base}/content?type=COURSE`, { cache: "no-store" });
  const data = await res.json();
  const arr = Array.isArray(data) ? data : [];
  return arr.slice(0, limit);
}

async function fetchAllMicro(limit = 20): Promise<MicroItem[]> {
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  const res = await fetch(`${base}/microlearning/feed?userId=anonymous&limit=${limit}&offset=0`, { cache: "no-store" });
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export function TrendingContent() {
  const { user } = useUser();
  const isSignedIn = !!user;
  const [trendingMicro, setTrendingMicro] = useState<MicroItem[]>([]);
  const [trendingCourses, setTrendingCourses] = useState<CourseItem[]>([]);
  const [allMicro, setAllMicro] = useState<MicroItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [authModal, setAuthModal] = useState<{ open: boolean; type: "micro" | "course" }>({ open: false, type: "micro" });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchTrendingMicro(4),
      fetchTrendingCourses(3),
      fetchAllMicro(20),
    ])
      .then(([micro, courses, feed]) => {
        if (!cancelled) {
          setTrendingMicro(micro);
          setTrendingCourses(courses);
          setAllMicro(feed);
        }
      })
      .catch(() => setTrendingMicro([]))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleCourseClick = (item: CourseItem) => {
    if (!isSignedIn) {
      setAuthModal({ open: true, type: "course" });
      return;
    }
    window.location.href = `/content/${item.id}`;
  };

  const microItems = trendingMicro.length > 0 ? trendingMicro : allMicro.slice(0, 4);

  if (loading) {
    return (
      <section className="px-4 py-16 md:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#059669] border-t-transparent" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="px-4 py-16 md:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Welcome */}
        <div className="mb-16 rounded-2xl bg-[#059669] px-6 py-10 text-white md:px-10 md:py-12">
          <h2 className="text-2xl font-bold md:text-3xl">Welcome to Omni Learn</h2>
          <p className="mt-2 text-lg opacity-90">
            {isSignedIn ? `Hello, ${user?.name ?? "Learner"}!` : "Unleash your potential"}
          </p>
          {!isSignedIn && (
            <Link
              href="/signin"
              className="mt-4 inline-block rounded-lg bg-white px-6 py-2.5 text-[#059669] font-semibold transition hover:opacity-90"
            >
              Sign in with Google
            </Link>
          )}
        </div>

        {/* Trending Micro-Learnings - horizontal list of 4 */}
        <div className="mb-16">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Trending Micro-Learnings</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">Short videos to learn on the go</p>
          {microItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-8 text-center text-gray-500">
              No micro-learnings yet. Content will appear here once available.
            </div>
          ) : (
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
            {microItems.map((item) => {
              const videoUrl = getVideoUrl(item);
              return (
                <Link
                  key={item.id}
                  href={`/micro/${item.id}`}
                  className="flex-shrink-0 w-56 rounded-xl overflow-hidden bg-gray-900 border border-gray-700 hover:border-[#059669] transition group block"
                >
                  <div className="aspect-[9/12] bg-gray-800 relative">
                    {videoUrl ? (
                      <video
                        src={videoUrl}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl text-gray-500">▶</div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-white font-medium text-sm line-clamp-2">{item.title}</p>
                      {item.durationMinutes && (
                        <p className="text-gray-300 text-xs mt-1">{item.durationMinutes} min</p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
          )}
        </div>

        {/* Trending Courses - 3 courses grid */}
        <div className="mb-16">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Trending Courses</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">Deep-dive into new skills</p>
          {trendingCourses.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-8 text-center text-gray-500">
              No courses yet. Content will appear here once available.
            </div>
          ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {trendingCourses.map((item) => (
              <button
                key={item.id}
                onClick={() => handleCourseClick(item)}
                className="text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-6 hover:border-[#059669] hover:shadow-lg transition"
              >
                <div className="w-12 h-12 rounded-lg bg-[#059669]/20 flex items-center justify-center text-2xl mb-4">📚</div>
                <h4 className="font-semibold text-gray-900 dark:text-white line-clamp-2">{item.title}</h4>
                {item.durationMinutes && (
                  <p className="text-sm text-gray-500 mt-2">{item.durationMinutes} min</p>
                )}
              </button>
            ))}
          </div>
          )}
        </div>

        {/* All content - more to explore */}
        {(allMicro.length > 4 || trendingCourses.length > 0) && (
          <div className="mb-16">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">More to explore</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Browse all microlearnings and courses</p>
            <div className="rounded-xl border-l-4 border-[#059669] bg-white dark:bg-gray-900/50 p-6">
              <Link
                href={isSignedIn ? "/discover" : "/signin"}
                className="block"
              >
                <h4 className="font-semibold text-gray-900 dark:text-white">Browse all content</h4>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  {allMicro.length > 0 ? `${allMicro.length} videos` : ""} • Search & discover
                </p>
                <span className="inline-block mt-3 text-[#059669] font-medium">Explore →</span>
              </Link>
            </div>
          </div>
        )}

        {/* Auth prompt modal */}
        {authModal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-sm w-full shadow-xl">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Sign in to continue</h3>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                {authModal.type === "micro"
                  ? "Sign in to watch micro-learning videos."
                  : "Sign in to enroll in courses and track your progress."}
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
                  onClick={() => setAuthModal({ open: false, type: "micro" })}
                  className="text-gray-500 text-sm py-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
