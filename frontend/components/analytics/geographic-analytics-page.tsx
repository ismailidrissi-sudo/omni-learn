"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApolloProvider, useQuery } from "@apollo/client/react";
import { apolloGeoClient } from "@/lib/apollo-geo-client";
import { GEO_OVERVIEW, LIVE_ACTIVITY } from "@/lib/geo-analytics-gql";
import { useAnalyticsFilters } from "@/components/analytics/analytics-filters-context";
import { WorldMapChoropleth, type CountryMetricRow } from "@/components/analytics/world-map-choropleth";
import { LiveActivityFeed, type LiveRow } from "@/components/analytics/live-activity-feed";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import {
  Users,
  UserPlus,
  CheckCircle,
  Award,
  Clock,
  Download,
} from "lucide-react";
import { downloadCsv } from "@/lib/csv-download";

type MetricKey =
  | "activeUsers"
  | "newRegistrations"
  | "courseCompletions"
  | "certsIssued"
  | "totalTimeSpentMin";

const METRICS: { key: MetricKey; label: string; icon: typeof Users }[] = [
  { key: "activeUsers", label: "Active users", icon: Users },
  { key: "newRegistrations", label: "New signups", icon: UserPlus },
  { key: "courseCompletions", label: "Completions", icon: CheckCircle },
  { key: "certsIssued", label: "Certificates", icon: Award },
  { key: "totalTimeSpentMin", label: "Learning time (min)", icon: Clock },
];

const GQL_METRIC: Record<MetricKey, string> = {
  activeUsers: "ACTIVE_USERS",
  newRegistrations: "NEW_REGISTRATIONS",
  courseCompletions: "COURSE_COMPLETIONS",
  certsIssued: "CERTS_ISSUED",
  totalTimeSpentMin: "TOTAL_TIME_SPENT",
};

function GeoInner() {
  const router = useRouter();
  const { filters, filtersRecord } = useAnalyticsFilters();
  const [metric, setMetric] = useState<MetricKey>("activeUsers");
  const [token, setToken] = useState<string | null>(null);
  const [hideError, setHideError] = useState(false);

  useEffect(() => {
    setToken(typeof window !== "undefined" ? localStorage.getItem("omnilearn_token") : null);
  }, []);

  const period = useMemo(() => {
    const fromStr = filters.from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const toStr = filters.to || new Date().toISOString().slice(0, 10);
    return {
      start: new Date(fromStr + "T00:00:00.000Z"),
      end: new Date(toStr + "T23:59:59.999Z"),
    };
  }, [filters.from, filters.to]);

  const tenantId = filters.tenantId || null;

  const { data, loading, error } = useQuery(GEO_OVERVIEW, {
    variables: {
      tenantId,
      period: { start: period.start.toISOString(), end: period.end.toISOString() },
      metric: GQL_METRIC[metric],
    },
    errorPolicy: "all",
  });

  const { data: liveData } = useQuery(LIVE_ACTIVITY, {
    variables: { tenantId, limit: 20 },
    pollInterval: 60_000,
    errorPolicy: "all",
  });

  type GeoOverviewData = {
    geoOverview?: {
      countries: Array<{
        countryCode: string;
        country: string;
        topCity?: string | null;
        activeUsers: number;
        newRegistrations: number;
        courseCompletions: number;
        certsIssued: number;
        totalTimeSpentMin: number;
      }>;
      continents: Array<{ continent: string; activeUsers: number; percentageOfTotal: number }>;
    };
  };
  const geoData = data as GeoOverviewData | undefined;

  const mapRows: CountryMetricRow[] = useMemo(() => {
    const countries = geoData?.geoOverview?.countries ?? [];
    return countries.map((c: { countryCode: string; country: string; topCity?: string | null; activeUsers: number; newRegistrations: number; courseCompletions: number; certsIssued: number; totalTimeSpentMin: number }) => ({
      countryCode: c.countryCode,
      country: c.country,
      topCity: c.topCity,
      value:
        metric === "activeUsers"
          ? c.activeUsers
          : metric === "newRegistrations"
            ? c.newRegistrations
            : metric === "courseCompletions"
              ? c.courseCompletions
              : metric === "certsIssued"
                ? c.certsIssued
                : c.totalTimeSpentMin,
    }));
  }, [geoData, metric]);

  const initialLive: LiveRow[] = useMemo(() => {
    const rows =
      (liveData as { liveActivity?: LiveRow[] } | undefined)?.liveActivity ?? [];
    return rows.map((r: { userName: string; city: string; country: string; action: string; contentTitle: string; timestamp: string }) => ({
      userName: r.userName,
      city: r.city,
      country: r.country,
      action: r.action,
      contentTitle: r.contentTitle,
      timestamp: r.timestamp,
    }));
  }, [liveData]);

  const continents = geoData?.geoOverview?.continents ?? [];
  const countries = geoData?.geoOverview?.countries ?? [];
  const maxCont = Math.max(...continents.map((x: { activeUsers: number }) => x.activeUsers), 1);

  return (
    <div className="space-y-6">
      {error && !hideError && (
        <ErrorBanner
          message={
            ("graphQLErrors" in error
              ? (error as unknown as { graphQLErrors: { message: string }[] })
                  .graphQLErrors?.[0]?.message
              : undefined) ||
            error.message ||
            "Failed to load geographic data"
          }
          onDismiss={() => setHideError(true)}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/analytics/geography/compare"
          className="text-sm text-brand-purple hover:underline mr-auto"
        >
          Compare countries →
        </Link>
        <div className="flex flex-wrap gap-2">
          {METRICS.map((m) => {
            const Icon = m.icon;
            const active = metric === m.key;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setMetric(m.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  active
                    ? "border-brand-purple bg-brand-purple/10 text-brand-purple"
                    : "border-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:border-brand-purple/40"
                }`}
              >
                <Icon size={14} />
                {m.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => downloadCsv("/analytics/deep/export/geo", filtersRecord, "geography")}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-brand-purple text-white rounded-lg hover:bg-brand-purple/90"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-purple border-t-transparent" />
        </div>
      )}

      {!loading && (
        <>
          <WorldMapChoropleth
            data={mapRows}
            metric={metric}
            onCountryClick={(code) => router.push(`/admin/analytics/geography/country/${code}`)}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Continent breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {continents.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">No data for this period.</p>
              ) : (
                continents.map((c: { continent: string; activeUsers: number; percentageOfTotal: number }) => (
                  <div key={c.continent} className="flex items-center gap-3">
                    <span className="text-sm w-36 shrink-0 text-[var(--color-text-primary)]">{c.continent}</span>
                    <div className="flex-1 h-2 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${Math.min(100, (c.activeUsers / maxCont) * 100)}%` }}
                      />
                    </div>
                    <span className="text-sm text-[var(--color-text-muted)] w-28 text-right">
                      {c.activeUsers.toLocaleString()} ({c.percentageOfTotal}%)
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Top countries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-bg-secondary)]">
                      <th className="py-2 pr-4">#</th>
                      <th className="py-2 pr-4">Country</th>
                      <th className="py-2 pr-4">Top city</th>
                      <th className="py-2 pr-4 text-right">Users</th>
                      <th className="py-2 text-right">Compl.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {countries.slice(0, 15).map((c: { country: string; countryCode: string; topCity?: string | null; activeUsers: number; courseCompletions: number }, i: number) => (
                      <tr key={c.countryCode} className="border-b border-[var(--color-bg-secondary)]/80">
                        <td className="py-2 pr-4">{i + 1}</td>
                        <td className="py-2 pr-4">
                          <Link
                            href={`/admin/analytics/geography/country/${c.countryCode}`}
                            className="font-medium text-brand-purple hover:underline"
                          >
                            {c.country}
                          </Link>
                        </td>
                        <td className="py-2 pr-4 text-[var(--color-text-muted)]">{c.topCity || "—"}</td>
                        <td className="py-2 pr-4 text-right">{c.activeUsers.toLocaleString()}</td>
                        <td className="py-2 text-right">{c.courseCompletions.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <LiveActivityFeed initial={initialLive} token={token} />
        </>
      )}
    </div>
  );
}

export function GeographicAnalyticsPage() {
  return (
    <ApolloProvider client={apolloGeoClient}>
      <GeoInner />
    </ApolloProvider>
  );
}
