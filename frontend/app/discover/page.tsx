"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { LearnLogo } from "@/components/ui/learn-logo";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NavToggles } from "@/components/ui/nav-toggles";
import { useUser } from "@/lib/use-user";
import { apiFetch } from "@/lib/api";

type ContentItem = {
  id: string;
  title: string;
  type?: string;
  description?: string;
  durationMinutes?: number;
  score?: number;
  source?: string;
  trendScore?: number;
  domain?: { name: string } | null;
};

type PathSuggestion = {
  id: string;
  name: string;
  description?: string;
  difficulty?: string;
  domain?: { name: string } | string;
  _count?: { enrollments: number };
};

const TYPE_META: Record<string, { icon: string; color: string }> = {
  COURSE: { icon: "📚", color: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800" },
  MICRO_LEARNING: { icon: "⚡", color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800" },
  PODCAST: { icon: "🎧", color: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800" },
  DOCUMENT: { icon: "📄", color: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/20 dark:text-slate-300 dark:border-slate-800" },
  VIDEO: { icon: "🎬", color: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800" },
  QUIZ_ASSESSMENT: { icon: "✅", color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800" },
  GAME: { icon: "🎮", color: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800" },
  IMPLEMENTATION_GUIDE: { icon: "🛠️", color: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800" },
};

const DIFFICULTY_COLORS: Record<string, string> = {
  BEGINNER: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  INTERMEDIATE: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  ADVANCED: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
};

function ContentCard({ item, rank }: { item: ContentItem; rank?: number }) {
  const typeLabel = item.type?.replace(/_/g, " ") ?? "";
  const meta = TYPE_META[item.type ?? ""] ?? { icon: "📖", color: "bg-gray-50 text-gray-700 border-gray-200" };

  return (
    <Link href={`/content/${item.id}`} className="block group">
      <div className="relative h-full p-5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 hover:shadow-lg hover:shadow-brand-purple/5 hover:border-brand-purple/30 dark:hover:border-brand-purple/40 transition-all duration-200">
        {rank != null && (
          <div className="absolute -top-2.5 -left-2.5 w-7 h-7 rounded-full bg-brand-purple text-white text-xs font-bold flex items-center justify-center shadow-md">
            {rank}
          </div>
        )}
        <div className="flex items-center gap-2 mb-3">
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${meta.color}`}>
            <span>{meta.icon}</span>
            {typeLabel}
          </span>
          {item.durationMinutes && (
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {item.durationMinutes} min
            </span>
          )}
        </div>
        <h3 className="font-semibold text-[var(--color-text-primary)] group-hover:text-brand-purple transition-colors line-clamp-2 mb-1.5 leading-snug">
          {item.title}
        </h3>
        {item.description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">{item.description}</p>
        )}
        {item.domain && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/5">
            <span className="text-xs text-brand-purple/70 dark:text-brand-purple-light/70 font-medium">
              {typeof item.domain === "string" ? item.domain : item.domain.name}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="p-5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 animate-pulse">
      <div className="flex gap-2 mb-3">
        <div className="h-6 w-20 bg-gray-100 dark:bg-white/10 rounded-full" />
        <div className="h-6 w-14 bg-gray-100 dark:bg-white/10 rounded-full ml-auto" />
      </div>
      <div className="h-5 w-3/4 bg-gray-100 dark:bg-white/10 rounded mb-2" />
      <div className="h-4 w-full bg-gray-100 dark:bg-white/10 rounded mb-1" />
      <div className="h-4 w-2/3 bg-gray-100 dark:bg-white/10 rounded" />
    </div>
  );
}

function SkeletonPathRow() {
  return (
    <div className="p-4 rounded-xl bg-gray-50 dark:bg-white/5 animate-pulse">
      <div className="h-5 w-2/3 bg-gray-100 dark:bg-white/10 rounded mb-2" />
      <div className="h-4 w-1/3 bg-gray-100 dark:bg-white/10 rounded" />
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  icon,
  action,
}: {
  title: string;
  subtitle?: string;
  icon: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div className="flex items-center gap-3">
        <span className="text-2xl" role="img">{icon}</span>
        <div>
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">{title}</h2>
          {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export default function DiscoverPage() {
  const { t } = useI18n();
  const { user } = useUser();
  const userId = user?.id ?? "anonymous";

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ContentItem[]>([]);
  const [recommendations, setRecommendations] = useState<ContentItem[]>([]);
  const [trending, setTrending] = useState<ContentItem[]>([]);
  const [pathSuggestions, setPathSuggestions] = useState<PathSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingRecs, setLoadingRecs] = useState(true);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [loadingPaths, setLoadingPaths] = useState(true);
  const [recSource, setRecSource] = useState<string>("");

  const fetchRecommendations = useCallback(() => {
    setLoadingRecs(true);
    apiFetch(`/intelligence/recommendations?userId=${userId}&limit=8`)
      .then((r) => r.json())
      .then((d) => {
        const items = Array.isArray(d) ? d : [];
        setRecommendations(items);
        setRecSource(items[0]?.source ?? "");
      })
      .catch(() => setRecommendations([]))
      .finally(() => setLoadingRecs(false));
  }, [userId]);

  const fetchTrending = useCallback(() => {
    setLoadingTrending(true);
    apiFetch("/intelligence/trending?limit=6")
      .then((r) => r.json())
      .then((d) => setTrending(Array.isArray(d) ? d : []))
      .catch(() => setTrending([]))
      .finally(() => setLoadingTrending(false));
  }, []);

  const fetchPaths = useCallback(() => {
    setLoadingPaths(true);
    apiFetch(`/intelligence/path-suggestions?userId=${userId}&limit=5`)
      .then((r) => r.json())
      .then((d) => setPathSuggestions(Array.isArray(d) ? d : []))
      .catch(() => setPathSuggestions([]))
      .finally(() => setLoadingPaths(false));
  }, [userId]);

  useEffect(() => {
    fetchRecommendations();
    fetchTrending();
    fetchPaths();
  }, [fetchRecommendations, fetchTrending, fetchPaths]);

  const search = () => {
    if (!query.trim()) return;
    setSearching(true);
    apiFetch(`/intelligence/search?q=${encodeURIComponent(query)}`)
      .then((r) => r.json())
      .then((d) => setSearchResults(Array.isArray(d) ? d : []))
      .catch(() => setSearchResults([]))
      .finally(() => setSearching(false));
  };

  const sourceLabel =
    recSource === "lightfm"
      ? "Powered by LightFM"
      : recSource === "cold_start"
        ? "Popular picks for new learners"
        : recSource === "embedding"
          ? "Based on your profile"
          : "";

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950">
      <header className="sticky top-0 z-40 border-b border-gray-200 dark:border-white/10 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl px-6 py-3">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <Link href="/">
            <LearnLogo size="md" variant="purple" />
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/learn"><Button variant="ghost" size="sm">{t("nav.learn")}</Button></Link>
            <Link href="/forum"><Button variant="ghost" size="sm">{t("nav.forums")}</Button></Link>
            <Link href="/referrals"><Button variant="ghost" size="sm">Referrals</Button></Link>
            <Link href="/trainer"><Button variant="ghost" size="sm">{t("nav.trainer")}</Button></Link>
            <div className="flex items-center gap-1 pl-3 ml-3 border-l border-gray-200 dark:border-white/10">
              <NavToggles />
            </div>
          </nav>
        </div>
      </header>

      {/* Hero search area */}
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-purple/5 via-white to-blue-50/50 dark:from-brand-purple/10 dark:via-gray-950 dark:to-blue-950/20 border-b border-gray-200/50 dark:border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-brand-purple/[0.07] via-transparent to-transparent" />
        <div className="relative max-w-6xl mx-auto px-6 py-12">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
              {t("discover.title")}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Find courses, paths, and learning resources tailored to your goals.
            </p>
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <Input
                  placeholder={t("discover.searchPlaceholder")}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && search()}
                  className="pl-12 !py-3 !rounded-xl !text-base !border-gray-300 dark:!border-white/15 !bg-white dark:!bg-white/5 shadow-sm"
                />
              </div>
              <Button onClick={search} disabled={searching} size="lg" className="!rounded-xl shadow-sm">
                {searching ? t("common.searching") : t("common.search")}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-10">
        {/* Search results */}
        {searchResults.length > 0 && (
          <section>
            <SectionHeader
              icon="🔍"
              title={t("discover.searchResults")}
              subtitle={`${searchResults.length} results for "${query}"`}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {searchResults.map((r) => (
                <ContentCard key={r.id} item={r} />
              ))}
            </div>
          </section>
        )}

        {/* Recommended for you */}
        <section>
          <SectionHeader
            icon="✨"
            title={t("discover.recommendedForYou")}
            subtitle={sourceLabel}
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchRecommendations}
                disabled={loadingRecs}
                className="text-brand-purple gap-1.5"
              >
                <svg className={`w-4 h-4 ${loadingRecs ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </Button>
            }
          />
          {loadingRecs ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : recommendations.length === 0 ? (
            <Card className="p-10 text-center">
              <span className="text-4xl mb-3 block">🎯</span>
              <p className="text-[var(--color-text-primary)] font-medium mb-1">No recommendations yet</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t("discover.noRecommendations")}</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {recommendations.map((r) => (
                <ContentCard key={r.id} item={r} />
              ))}
            </div>
          )}
        </section>

        {/* Trending + Path suggestions grid */}
        <div className="grid lg:grid-cols-5 gap-8">
          {/* Trending */}
          <section className="lg:col-span-3">
            <SectionHeader
              icon="🔥"
              title="Trending Now"
              subtitle="Most popular content this week"
            />
            {loadingTrending ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : trending.length === 0 ? (
              <Card className="p-10 text-center">
                <span className="text-4xl mb-3 block">📊</span>
                <p className="text-[var(--color-text-primary)] font-medium mb-1">No trending content yet</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Check back soon as content gains traction.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {trending.map((item, i) => (
                  <ContentCard key={item.id} item={item} rank={i + 1} />
                ))}
              </div>
            )}
          </section>

          {/* Suggested paths */}
          <section className="lg:col-span-2">
            <SectionHeader icon="🛤️" title={t("discover.suggestedPaths")} />
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                {loadingPaths ? (
                  <div className="p-4 space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => <SkeletonPathRow key={i} />)}
                  </div>
                ) : pathSuggestions.length === 0 ? (
                  <div className="p-8 text-center">
                    <span className="text-3xl mb-2 block">🧭</span>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t("discover.noPathSuggestions")}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-white/5">
                    {pathSuggestions.map((p) => {
                      const domainName = typeof p.domain === "object" ? p.domain?.name : p.domain;
                      return (
                        <div
                          key={p.id}
                          className="p-4 hover:bg-brand-purple/[0.03] dark:hover:bg-brand-purple/[0.06] transition-colors cursor-pointer group"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-lg bg-brand-purple/10 dark:bg-brand-purple/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <svg className="w-4.5 h-4.5 text-brand-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-[var(--color-text-primary)] group-hover:text-brand-purple transition-colors truncate">
                                {p.name}
                              </p>
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                {domainName && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400">{domainName}</span>
                                )}
                                {p.difficulty && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DIFFICULTY_COLORS[p.difficulty] ?? "bg-gray-100 text-gray-600"}`}>
                                    {p.difficulty.charAt(0) + p.difficulty.slice(1).toLowerCase()}
                                  </span>
                                )}
                                {p._count?.enrollments != null && p._count.enrollments > 0 && (
                                  <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto flex items-center gap-1">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                    {p._count.enrollments}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
    </div>
  );
}
