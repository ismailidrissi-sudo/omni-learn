"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LearnLogo } from "@/components/ui/learn-logo";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NavToggles } from "@/components/ui/nav-toggles";
import { useUser } from "@/lib/use-user";
import { apiFetch } from "@/lib/api";

export default function DiscoverPage() {
  const { t } = useI18n();
  const { user } = useUser();
  const userId = user?.id ?? "anonymous";
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [pathSuggestions, setPathSuggestions] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    apiFetch(`/intelligence/recommendations?userId=${userId}`)
      .then((r) => r.json())
      .then((d) => (Array.isArray(d) ? d : []))
      .then(setRecommendations)
      .catch(() => setRecommendations([]));
    apiFetch(`/intelligence/path-suggestions?userId=${userId}`)
      .then((r) => r.json())
      .then((d) => (Array.isArray(d) ? d : []))
      .then(setPathSuggestions)
      .catch(() => setPathSuggestions([]));
  }, [userId]);

  const search = () => {
    if (!query.trim()) return;
    setSearching(true);
    apiFetch(`/intelligence/search?q=${encodeURIComponent(query)}`)
      .then((r) => r.json())
      .then((d) => (Array.isArray(d) ? d : []))
      .then(setSearchResults)
      .catch(() => setSearchResults([]))
      .finally(() => setSearching(false));
  };

  return (
    <div className="min-h-screen bg-white">
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

      <main className="max-w-4xl mx-auto p-6">
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
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>{t("discover.searchResults")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {searchResults.map((r) => (
                  <Link key={r.id} href={`/content/${r.id}`} className="block p-3 rounded-lg hover:bg-brand-purple/5">
                    <span className="font-medium">{r.title}</span>
                    <span className="text-brand-grey text-sm ml-2">({r.type})</span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("discover.recommendedForYou")}</CardTitle>
            </CardHeader>
            <CardContent>
              {recommendations.length === 0 ? (
                <p className="text-brand-grey text-sm">{t("discover.noRecommendations")}</p>
              ) : (
                <div className="space-y-2">
                  {recommendations.slice(0, 5).map((r) => (
                    <Link key={r.id} href={`/content/${r.id}`} className="block text-brand-purple hover:underline">
                      {r.title}
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("discover.suggestedPaths")}</CardTitle>
            </CardHeader>
            <CardContent>
              {pathSuggestions.length === 0 ? (
                <p className="text-brand-grey text-sm">{t("discover.noPathSuggestions")}</p>
              ) : (
                <div className="space-y-2">
                  {pathSuggestions.slice(0, 5).map((p) => (
                    <div key={p.id} className="p-2 rounded bg-brand-purple/5">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-brand-grey text-sm ml-2">({typeof p.domain === "object" ? p.domain?.name : p.domain})</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
