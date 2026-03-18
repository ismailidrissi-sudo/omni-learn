"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { LearnLogo } from "@/components/ui/learn-logo";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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

const TYPE_ICONS: Record<string, string> = {
  COURSE: "📚",
  MICRO_LEARNING: "⚡",
  PODCAST: "🎧",
  DOCUMENT: "📄",
  VIDEO: "🎬",
  QUIZ_ASSESSMENT: "✅",
  GAME: "🎮",
  IMPLEMENTATION_GUIDE: "🛠️",
};

function ContentCard({ item }: { item: ContentItem }) {
  const typeLabel = item.type?.replace(/_/g, " ") ?? "";
  const icon = TYPE_ICONS[item.type ?? ""] ?? "📖";

  return (
    <Link href={`/content/${item.id}`} className="block group">
      <div className="p-4 rounded-xl border border-brand-grey-light bg-white hover:shadow-md hover:border-brand-purple/30 transition-all duration-200">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm">{icon}</span>
          <span className="text-xs font-medium text-brand-grey bg-brand-purple/5 px-2 py-0.5 rounded-full">
            {typeLabel}
          </span>
          {item.durationMinutes && (
            <span className="text-xs text-brand-grey ml-auto">{item.durationMinutes} min</span>
          )}
        </div>
        <h3 className="font-semibold text-brand-grey-dark group-hover:text-brand-purple transition-colors line-clamp-2 mb-1">
          {item.title}
        </h3>
        {item.description && (
          <p className="text-xs text-brand-grey line-clamp-2">{item.description}</p>
        )}
        {item.domain && (
          <p className="text-xs text-brand-purple/60 mt-2">
            {typeof item.domain === "string" ? item.domain : item.domain.name}
          </p>
        )}
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="p-4 rounded-xl border border-brand-grey-light bg-white animate-pulse">
      <div className="flex gap-2 mb-3">
        <div className="h-5 w-16 bg-brand-grey-light rounded-full" />
        <div className="h-5 w-12 bg-brand-grey-light rounded-full ml-auto" />
      </div>
      <div className="h-5 w-3/4 bg-brand-grey-light rounded mb-2" />
      <div className="h-4 w-full bg-brand-grey-light rounded mb-1" />
      <div className="h-4 w-2/3 bg-brand-grey-light rounded" />
    </div>
  );
}

function SkeletonPathRow() {
  return (
    <div className="p-3 rounded-lg bg-brand-purple/5 animate-pulse">
      <div className="h-5 w-2/3 bg-brand-grey-light rounded mb-1" />
      <div className="h-4 w-1/3 bg-brand-grey-light rounded" />
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
        ? "Popular picks"
        : recSource === "embedding"
          ? "Based on your profile"
          : "";

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <header className="border-b border-brand-grey-light px-6 py-4 flex justify-between items-center">
        <Link href="/">
          <LearnLogo size="md" variant="purple" />
        </Link>
        <nav className="flex items-center gap-4">
          <Link href="/learn"><Button variant="ghost" size="sm">{t("nav.learn")}</Button></Link>
          <Link href="/forum"><Button variant="ghost" size="sm">{t("nav.forums")}</Button></Link>
          <Link href="/referrals"><Button variant="ghost" size="sm">Referrals</Button></Link>
          <Link href="/trainer"><Button variant="ghost" size="sm">{t("nav.trainer")}</Button></Link>
          <div className="flex items-center gap-1 pl-4 ml-4 border-l border-brand-grey-light">
            <NavToggles />
          </div>
        </nav>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-brand-grey-dark mb-6">{t("discover.title")}</h1>

        <div className="flex gap-2 mb-8">
          <Input
            placeholder={t("discover.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            className="flex-1"
          />
          <Button onClick={search} disabled={searching}>
            {searching ? t("common.searching") : t("common.search")}
          </Button>
        </div>

        {searchResults.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-semibold text-brand-grey-dark mb-4">
              {t("discover.searchResults")}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {searchResults.map((r) => (
                <ContentCard key={r.id} item={r} />
              ))}
            </div>
          </section>
        )}

        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-brand-grey-dark">
                {t("discover.recommendedForYou")}
              </h2>
              {sourceLabel && (
                <p className="text-xs text-brand-grey mt-0.5">{sourceLabel}</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchRecommendations}
              disabled={loadingRecs}
              className="text-brand-purple"
            >
              {loadingRecs ? "..." : "↻ Refresh"}
            </Button>
          </div>
          {loadingRecs ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : recommendations.length === 0 ? (
            <p className="text-brand-grey text-sm py-8 text-center">{t("discover.noRecommendations")}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {recommendations.map((r) => (
                <ContentCard key={r.id} item={r} />
              ))}
            </div>
          )}
        </section>

        <div className="grid md:grid-cols-5 gap-6">
          <section className="md:col-span-3">
            <h2 className="text-lg font-semibold text-brand-grey-dark mb-4">
              Trending Now
            </h2>
            {loadingTrending ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : trending.length === 0 ? (
              <p className="text-brand-grey text-sm py-8 text-center">No trending content yet</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {trending.map((item) => (
                  <ContentCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </section>

          <section className="md:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("discover.suggestedPaths")}</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingPaths ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => <SkeletonPathRow key={i} />)}
                  </div>
                ) : pathSuggestions.length === 0 ? (
                  <p className="text-brand-grey text-sm">{t("discover.noPathSuggestions")}</p>
                ) : (
                  <div className="space-y-3">
                    {pathSuggestions.map((p) => {
                      const domainName = typeof p.domain === "object" ? p.domain?.name : p.domain;
                      return (
                        <div key={p.id} className="p-3 rounded-lg bg-brand-purple/5 hover:bg-brand-purple/10 transition-colors">
                          <div className="font-medium text-brand-grey-dark">{p.name}</div>
                          <div className="flex items-center gap-2 mt-1">
                            {domainName && (
                              <span className="text-xs text-brand-grey">{domainName}</span>
                            )}
                            {p.difficulty && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-brand-purple/10 text-brand-purple">
                                {p.difficulty}
                              </span>
                            )}
                            {p._count?.enrollments != null && p._count.enrollments > 0 && (
                              <span className="text-xs text-brand-grey ml-auto">
                                {p._count.enrollments} enrolled
                              </span>
                            )}
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
