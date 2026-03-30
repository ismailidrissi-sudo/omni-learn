"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ApolloProvider, useQuery } from "@apollo/client/react";
import { apolloGeoClient } from "@/lib/apollo-geo-client";
import { COUNTRY_ANALYTICS } from "@/lib/geo-analytics-gql";
import { useAnalyticsFilters } from "@/components/analytics/analytics-filters-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";

function CountryInner() {
  const params = useParams();
  const code = typeof params.code === "string" ? params.code.toUpperCase() : "";
  const { filters } = useAnalyticsFilters();
  const tenantId = filters.tenantId || null;

  const period = useMemo(() => {
    const start = new Date(filters.from + "T00:00:00.000Z");
    const end = new Date(filters.to + "T23:59:59.999Z");
    return { start, end };
  }, [filters.from, filters.to]);

  const { data, loading, error } = useQuery(COUNTRY_ANALYTICS, {
    variables: {
      countryCode: code,
      tenantId,
      period: { start: period.start.toISOString(), end: period.end.toISOString() },
    },
    skip: !tenantId || !code,
  });

  type CountryDetail = {
    country: string;
    countryCode: string;
    kpis: {
      activeUsers: number;
      newSignups: number;
      completions: number;
      certsIssued: number;
    };
    cities: { city: string; totalUsers: number; completions: number }[];
    deviceBreakdown: { webPct: number; iosPct: number; androidPct: number };
    topLearners: { displayName: string; city?: string | null; points: number; pathsDone: number }[];
  };
  const d = (data as { countryAnalytics?: CountryDetail } | undefined)?.countryAnalytics;

  if (!tenantId) {
    return <p className="text-sm text-[var(--color-text-muted)]">Select a tenant in filters.</p>;
  }

  return (
    <div className="space-y-6">
      <Link href="/admin/analytics/geography" className="text-sm text-brand-purple hover:underline">
        ← Back to world map
      </Link>

      {error && <ErrorBanner message={error.message} onDismiss={() => {}} />}

      {loading && (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-purple border-t-transparent" />
        </div>
      )}

      {!loading && d && (
        <>
          <div className="flex items-center gap-3">
            <img
              src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`}
              alt=""
              className="w-10 h-7 rounded shadow-sm object-cover"
              width={40}
              height={28}
            />
            <div>
              <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{d.country}</h2>
              <p className="text-sm text-[var(--color-text-muted)]">
                {d.kpis.activeUsers.toLocaleString()} users in selected period
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ["Active users", d.kpis.activeUsers],
              ["New signups", d.kpis.newSignups],
              ["Completions", d.kpis.completions],
              ["Certificates", d.kpis.certsIssued],
            ].map(([label, val]) => (
              <Card key={String(label)}>
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs font-medium text-[var(--color-text-muted)]">{label}</CardTitle>
                </CardHeader>
                <CardContent className="text-lg font-semibold">{Number(val).toLocaleString()}</CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Cities</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm space-y-2">
                {d.cities.slice(0, 12).map((c: { city: string; totalUsers: number; completions: number }) => (
                  <li key={c.city} className="flex justify-between border-b border-[var(--color-bg-secondary)]/80 py-2">
                    <span>{c.city}</span>
                    <span className="text-[var(--color-text-muted)]">
                      {c.totalUsers} users · {c.completions} compl.
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Device split</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              Web {d.deviceBreakdown.webPct}% · iOS {d.deviceBreakdown.iosPct}% · Android{" "}
              {d.deviceBreakdown.androidPct}%
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Top learners</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm space-y-2">
                {d.topLearners.map(
                  (u: { displayName: string; city?: string | null; points: number; pathsDone: number }) => (
                    <li key={u.displayName} className="flex justify-between">
                      <span>
                        {u.displayName}
                        {u.city ? <span className="text-[var(--color-text-muted)]"> — {u.city}</span> : null}
                      </span>
                      <span className="text-[var(--color-text-muted)]">
                        {u.points} pts · {u.pathsDone} paths
                      </span>
                    </li>
                  ),
                )}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default function CountryDrilldownPage() {
  return (
    <ApolloProvider client={apolloGeoClient}>
      <CountryInner />
    </ApolloProvider>
  );
}
