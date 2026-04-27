"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ApolloProvider, useQuery } from "@apollo/client/react";
import { apolloGeoClient } from "@/lib/apollo-geo-client";
import { COMPARE_COUNTRIES } from "@/lib/geo-analytics-gql";
import { useAnalyticsFilters } from "@/components/analytics/analytics-filters-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function CompareInner() {
  const { filters } = useAnalyticsFilters();
  const tenantId = filters.tenantId || null;
  const [input, setInput] = useState("MA, FR, US");
  const [codes, setCodes] = useState<string[]>(["MA", "FR", "US"]);

  const period = useMemo(() => {
    const fromStr = filters.from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const toStr = filters.to || new Date().toISOString().slice(0, 10);
    return {
      start: new Date(fromStr + "T00:00:00.000Z"),
      end: new Date(toStr + "T23:59:59.999Z"),
    };
  }, [filters.from, filters.to]);

  const { data, loading, error } = useQuery(COMPARE_COUNTRIES, {
    variables: {
      countryCodes: codes,
      tenantId,
      period: { start: period.start.toISOString(), end: period.end.toISOString() },
    },
    skip: codes.length < 2,
    errorPolicy: "all",
  });

  type Row = {
    country: string;
    countryCode: string;
    activeUsers: number;
    avgTimePerUser: number;
    completionRate: number;
    topDomain: string;
    topCity: string;
    certsIssued: number;
    avgQuizScore: number;
  };
  const rows: Row[] =
    (data as { compareCountries?: { countries: Row[] } } | undefined)?.compareCountries?.countries ?? [];

  const apply = () => {
    const next = input
      .split(/[\s,]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 4);
    if (next.length >= 2) setCodes(next);
  };

  return (
    <div className="space-y-6">
      <Link href="/admin/analytics/geography" className="text-sm text-brand-purple hover:underline">
        ← Geographic overview
      </Link>

      {!tenantId && (
        <p className="text-xs text-[var(--color-text-muted)]">
          All companies — comparison aggregates users across every tenant you can access.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Compare countries (2–4 ISO codes)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 flex flex-wrap items-end gap-2">
          <input
            className="flex-1 min-w-[200px] px-3 py-2 rounded-lg border border-[var(--color-bg-secondary)] bg-[var(--color-bg-primary)] text-sm"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            type="button"
            onClick={apply}
            className="px-4 py-2 rounded-lg bg-brand-purple text-white text-sm font-medium hover:bg-brand-purple/90"
          >
            Apply
          </button>
          {error && <p className="text-xs text-red-600 w-full">{error.message}</p>}
        </CardContent>
      </Card>

      {loading && <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>}

      {!loading && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-[var(--color-bg-secondary)] rounded-lg">
            <thead>
              <tr className="bg-[var(--color-bg-secondary)]/40 text-left">
                <th className="p-2">Metric</th>
                {rows.map((r) => (
                  <th key={r.countryCode} className="p-2">
                    {r.country}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-[var(--color-bg-secondary)]">
                <td className="p-2 font-medium text-[var(--color-text-muted)]">Active users</td>
                {rows.map((r) => (
                  <td key={r.countryCode} className="p-2">
                    {r.activeUsers.toLocaleString()}
                  </td>
                ))}
              </tr>
              <tr className="border-t border-[var(--color-bg-secondary)]">
                <td className="p-2 font-medium text-[var(--color-text-muted)]">Avg time / user (h)</td>
                {rows.map((r) => (
                  <td key={r.countryCode} className="p-2">
                    {r.avgTimePerUser.toFixed(1)}
                  </td>
                ))}
              </tr>
              <tr className="border-t border-[var(--color-bg-secondary)]">
                <td className="p-2 font-medium text-[var(--color-text-muted)]">Completion rate</td>
                {rows.map((r) => (
                  <td key={r.countryCode} className="p-2">
                    {r.completionRate}%
                  </td>
                ))}
              </tr>
              <tr className="border-t border-[var(--color-bg-secondary)]">
                <td className="p-2 font-medium text-[var(--color-text-muted)]">Top domain</td>
                {rows.map((r) => (
                  <td key={r.countryCode} className="p-2">
                    {r.topDomain}
                  </td>
                ))}
              </tr>
              <tr className="border-t border-[var(--color-bg-secondary)]">
                <td className="p-2 font-medium text-[var(--color-text-muted)]">Top city</td>
                {rows.map((r) => (
                  <td key={r.countryCode} className="p-2">
                    {r.topCity}
                  </td>
                ))}
              </tr>
              <tr className="border-t border-[var(--color-bg-secondary)]">
                <td className="p-2 font-medium text-[var(--color-text-muted)]">Certificates</td>
                {rows.map((r) => (
                  <td key={r.countryCode} className="p-2">
                    {r.certsIssued.toLocaleString()}
                  </td>
                ))}
              </tr>
              <tr className="border-t border-[var(--color-bg-secondary)]">
                <td className="p-2 font-medium text-[var(--color-text-muted)]">Avg quiz</td>
                {rows.map((r) => (
                  <td key={r.countryCode} className="p-2">
                    {r.avgQuizScore}%
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function CompareCountriesPage() {
  return (
    <ApolloProvider client={apolloGeoClient}>
      <CompareInner />
    </ApolloProvider>
  );
}
