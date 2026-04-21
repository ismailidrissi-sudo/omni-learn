"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useUser } from "@/lib/use-user";
import { useI18n } from "@/lib/i18n/context";
import { apiFetch, apiAbsoluteMediaUrl } from "@/lib/api";
import { detectProvider } from "@/lib/video-provider";

type ContentItem = {
  id: string;
  title: string;
  type: string;
  metadata?: string | Record<string, unknown>;
  mediaId?: string;
  durationMinutes?: number;
  description?: string;
};

type RecommendationItem = {
  id: string;
  title: string;
  type?: string;
  description?: string;
  durationMinutes?: number;
  metadata?: string | Record<string, unknown>;
};

function parseMetadata(meta: string | Record<string, unknown> | undefined): Record<string, unknown> {
  if (!meta) return {};
  try {
    return typeof meta === "string" ? JSON.parse(meta || "{}") : meta;
  } catch {
    return {};
  }
}

function getVideoUrl(item: ContentItem): string | null {
  const meta = parseMetadata(item.metadata);
  const hlsUrl = meta?.hlsUrl as string | undefined;
  const videoUrl = meta?.videoUrl as string | undefined;
  return hlsUrl || videoUrl || item.mediaId || null;
}

async function fetchTrendingMicro(userId: string, limit = 4): Promise<ContentItem[]> {
  const res = await apiFetch(`/microlearning/feed?userId=${encodeURIComponent(userId)}&limit=${limit}&offset=0`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function fetchTrendingCourses(limit = 3): Promise<ContentItem[]> {
  const res = await apiFetch("/content?type=COURSE");
  const data = await res.json();
  const arr = Array.isArray(data) ? data : [];
  return arr.slice(0, limit);
}

async function fetchTrendingPodcasts(limit = 3): Promise<ContentItem[]> {
  const res = await apiFetch("/content?type=PODCAST");
  const data = await res.json();
  const arr = Array.isArray(data) ? data : [];
  return arr.slice(0, limit);
}

async function fetchRecommendations(userId: string, limit = 4): Promise<RecommendationItem[]> {
  const res = await apiFetch(`/intelligence/recommendations?userId=${encodeURIComponent(userId)}&limit=${limit}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export function TrendingContent() {
  const { t } = useI18n();
  const { user } = useUser();
  const isSignedIn = !!user;
  const userId = user?.id ?? "anonymous";
  const [trendingMicro, setTrendingMicro] = useState<ContentItem[]>([]);
  const [trendingCourses, setTrendingCourses] = useState<ContentItem[]>([]);
  const [trendingPodcasts, setTrendingPodcasts] = useState<ContentItem[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [authModal, setAuthModal] = useState<{ open: boolean; type: "micro" | "course" | "podcast" }>({ open: false, type: "micro" });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchTrendingMicro(userId, 4),
      fetchTrendingCourses(3),
      fetchTrendingPodcasts(3),
      fetchRecommendations(userId, 4),
    ])
      .then(([micro, courses, podcasts, recs]) => {
        if (!cancelled) {
          setTrendingMicro(micro);
          setTrendingCourses(courses);
          setTrendingPodcasts(podcasts);
          setRecommendations(recs);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [userId]);

  const handleContentClick = (id: string, kind: "course" | "podcast" | "micro") => {
    if (!isSignedIn) {
      setAuthModal({ open: true, type: kind === "micro" ? "micro" : kind });
      return;
    }
    if (kind === "micro") {
      window.location.href = `/micro/${id}`;
      return;
    }
    window.location.href = `/content/${id}`;
  };

  const hasContent = trendingMicro.length > 0 || trendingCourses.length > 0 || trendingPodcasts.length > 0 || recommendations.length > 0;

  if (!loaded) {
    return (
      <section className="px-4 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#059669] border-t-transparent" />
          </div>
        </div>
      </section>
    );
  }

  if (!hasContent) return null;

  return (
    <section className="px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl font-bold text-gray-900 dark:text-[#F5F5DC] md:text-4xl">
            {t("landing.trending.title")}
          </h2>
          <p className="mt-4 text-gray-600 dark:text-[#D4B896] max-w-2xl mx-auto">
            {t("landing.trending.subtitle")}
          </p>
        </motion.div>

        {/* Micro-Learnings */}
        {trendingMicro.length > 0 && (
          <div className="mb-14">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
              {t("landing.trending.micro")}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t("landing.trending.microDesc")}
            </p>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
              {trendingMicro.map((item) => {
                const videoUrl = getVideoUrl(item);
                const provider = videoUrl ? detectProvider(videoUrl) : null;
                const thumbnailUrl = provider?.thumbnailUrl ?? null;
                const microThumbSrc = thumbnailUrl ? (apiAbsoluteMediaUrl(thumbnailUrl) ?? thumbnailUrl) : "";
                const canPlayDirectly = videoUrl && provider?.provider === "direct";
                return (
                  <Link
                    key={item.id}
                    href={`/micro/${item.id}`}
                    className="flex-shrink-0 w-56 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:border-[#059669] transition group block"
                  >
                    <div className="aspect-[9/12] bg-gray-200 dark:bg-gray-800 relative">
                      {microThumbSrc ? (
                        <img
                          src={microThumbSrc}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : canPlayDirectly ? (
                        <video
                          src={videoUrl}
                          className="w-full h-full object-cover"
                          muted
                          playsInline
                          preload="metadata"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl text-gray-400 dark:text-gray-500">▶</div>
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
          </div>
        )}

        {/* Courses */}
        {trendingCourses.length > 0 && (
          <div className="mb-14">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
              {t("landing.trending.courses")}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t("landing.trending.coursesDesc")}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {trendingCourses.map((item) => {
                const courseMeta = parseMetadata(item.metadata);
                const landingMeta = courseMeta?.landingPage as Record<string, string> | undefined;
                const thumbUrl = landingMeta?.thumbnailUrl;
                const courseThumbSrc = thumbUrl ? (apiAbsoluteMediaUrl(thumbUrl) ?? thumbUrl) : "";
                return (
                  <button
                    key={item.id}
                    onClick={() => handleContentClick(item.id, "course")}
                    className="text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1e18] overflow-hidden hover:border-[#059669] hover:shadow-lg transition"
                  >
                    {courseThumbSrc ? (
                      <div className="w-full h-40 overflow-hidden">
                        <img src={courseThumbSrc} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-full h-40 bg-gradient-to-br from-[#059669]/15 to-[#059669]/5 flex items-center justify-center text-5xl">📚</div>
                    )}
                    <div className="p-5">
                      <h4 className="font-semibold text-gray-900 dark:text-white line-clamp-2">{item.title}</h4>
                      {item.description && <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">{item.description}</p>}
                      {item.durationMinutes && (
                        <p className="text-sm text-gray-500 mt-2">{item.durationMinutes} min</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Podcasts */}
        {trendingPodcasts.length > 0 && (
          <div className="mb-14">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
              {t("landing.trending.podcasts")}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t("landing.trending.podcastsDesc")}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {trendingPodcasts.map((item) => {
                const meta = parseMetadata(item.metadata);
                const thumbnailUrl = meta?.thumbnailUrl as string | undefined;
                const podThumbSrc = thumbnailUrl ? (apiAbsoluteMediaUrl(thumbnailUrl) ?? thumbnailUrl) : "";
                return (
                  <button
                    key={item.id}
                    onClick={() => handleContentClick(item.id, "podcast")}
                    className="text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1e18] p-6 hover:border-[#059669] hover:shadow-lg transition"
                  >
                    {podThumbSrc ? (
                      <div className="mb-4 rounded-lg overflow-hidden aspect-video">
                        <img src={podThumbSrc} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-[#059669]/15 flex items-center justify-center text-2xl mb-4">🎧</div>
                    )}
                    <h4 className="font-semibold text-gray-900 dark:text-white line-clamp-2">{item.title}</h4>
                    {item.durationMinutes && (
                      <p className="text-sm text-gray-500 mt-2">{item.durationMinutes} min</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Personalized Recommendations */}
        {recommendations.length > 0 && (
          <div className="mb-14">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
              {t("landing.trending.recommended")}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t("landing.trending.recommendedDesc")}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {recommendations.map((item) => {
                const recMeta = parseMetadata(item.metadata);
                const recLanding = recMeta?.landingPage as Record<string, string> | undefined;
                const recThumb = recLanding?.thumbnailUrl;
                const recThumbSrc = recThumb ? (apiAbsoluteMediaUrl(recThumb) ?? recThumb) : "";
                return (
                  <button
                    key={item.id}
                    onClick={() =>
                      handleContentClick(
                        item.id,
                        item.type === "MICRO_LEARNING"
                          ? "micro"
                          : item.type === "PODCAST"
                            ? "podcast"
                            : "course",
                      )
                    }
                    className="text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1e18] overflow-hidden hover:border-[#059669] hover:shadow-lg transition group"
                  >
                    {recThumbSrc ? (
                      <div className="w-full h-28 overflow-hidden">
                        <img src={recThumbSrc} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-full h-28 bg-gradient-to-br from-[#059669]/15 to-[#10b981]/5 flex items-center justify-center text-3xl">
                        {item.type === "PODCAST" ? "🎧" : item.type === "MICRO_LEARNING" ? "▶" : "📚"}
                      </div>
                    )}
                    <div className="p-4">
                      <h4 className="font-semibold text-gray-900 dark:text-white line-clamp-2 text-sm">{item.title}</h4>
                      {item.type && (
                        <span className="inline-block mt-2 text-[10px] uppercase tracking-wider font-medium text-[#059669] dark:text-[#10b981]">
                          {item.type.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Explore all */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <Link
            href={isSignedIn ? "/discover" : "/signup"}
            className="inline-flex items-center gap-2 rounded-lg border-2 border-[#059669] px-6 py-3 text-base font-semibold text-[#059669] transition-all hover:bg-[#059669] hover:text-white dark:text-[#10b981] dark:border-[#10b981] dark:hover:bg-[#10b981] dark:hover:text-white"
          >
            {t("landing.trending.exploreAll")}
            <span aria-hidden>→</span>
          </Link>
        </motion.div>
      </div>

      {/* Auth prompt modal */}
      {authModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t("landing.signInToContinue")}</h3>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              {authModal.type === "micro"
                ? "Sign in to watch micro-learning videos."
                : authModal.type === "podcast"
                  ? "Sign in to listen to podcasts."
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
    </section>
  );
}
