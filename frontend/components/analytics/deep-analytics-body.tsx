"use client";

import { useState, useEffect, useCallback } from "react";
import { ErrorBanner } from "@/components/ui/error-banner";
import { apiFetch } from "@/lib/api";
import { OverviewTab } from "@/components/analytics/overview-tab";
import { UsersTab } from "@/components/analytics/users-tab";
import { ContentTab } from "@/components/analytics/content-tab";
import { DemographicsTab } from "@/components/analytics/demographics-tab";
import { EngagementTab } from "@/components/analytics/engagement-tab";
import { useAnalyticsFilters } from "@/components/analytics/analytics-filters-context";

async function parseAnalyticsJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new Error("Invalid response from server.");
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    if (body && typeof body === "object" && body !== null && "message" in body) {
      const m = (body as { message: unknown }).message;
      if (Array.isArray(m)) msg = m.join(", ");
      else if (typeof m === "string") msg = m;
    }
    throw new Error(msg);
  }
  return body as T;
}

type Section = "overview" | "users" | "content" | "demographics" | "engagement";

export function DeepAnalyticsBody({ section }: { section: Section }) {
  const {
    filtersQuery,
    filtersRecord,
    setCountries,
    usersPage,
    setUsersPage,
    contentPage,
    setContentPage,
  } = useAnalyticsFilters();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  type OverviewData = {
    totalUsers: number;
    activeUsers: number;
    newUsers: number;
    totalSessions: number;
    avgSessionDuration: number;
    totalPageViews: number;
    totalEnrollments: number;
    totalCompletions: number;
    completionRate: number;
    totalLearningHours: number;
  };
  type TimelinePoint = { date: string; sessions: number };
  type BrowsersBreakdown = {
    browsers: { name: string; count: number }[];
    operatingSystems: { name: string; count: number }[];
  };
  type DeviceRow = { deviceType: string; count: number; percentage: number };
  type FunnelStage = { stage: string; count: number };
  type VelocityRow = { courseId: string; title: string; avgDaysToComplete: number; completions: number };
  type RetentionRow = { cohort: string; months: { month: string; users: number }[] };
  type GeoAnalytics = { countries?: { country: string }[] };

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [timeline, setTimeline] = useState<{ date: string; sessions: number }[]>([]);
  const [heatmap, setHeatmap] = useState<number[][]>(Array.from({ length: 7 }, () => Array(24).fill(0)));
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [browsers, setBrowsers] = useState<BrowsersBreakdown>({ browsers: [], operatingSystems: [] });
  const [usersData, setUsersData] = useState<any>(null);
  const [contentData, setContentData] = useState<any>(null);
  const [demographics, setDemographics] = useState<any>(null);
  const [funnel, setFunnel] = useState<FunnelStage[]>([]);
  const [velocity, setVelocity] = useState<VelocityRow[]>([]);
  const [retention, setRetention] = useState<RetentionRow[]>([]);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      if (section === "overview") {
        const [ov, tl, hm, dv, br] = await Promise.all([
          apiFetch(`/analytics/deep/overview?${filtersQuery}`).then((r) => parseAnalyticsJson<OverviewData>(r)),
          apiFetch(`/analytics/deep/timeline?${filtersQuery}`).then((r) => parseAnalyticsJson<TimelinePoint[]>(r)),
          apiFetch(`/analytics/deep/heatmap?${filtersQuery}`).then((r) => parseAnalyticsJson<number[][]>(r)),
          apiFetch(`/analytics/deep/devices?${filtersQuery}`).then((r) => parseAnalyticsJson<DeviceRow[]>(r)),
          apiFetch(`/analytics/deep/browsers?${filtersQuery}`).then((r) => parseAnalyticsJson<BrowsersBreakdown>(r)),
        ]);
        setOverview(ov);
        setTimeline(tl);
        setHeatmap(hm);
        setDevices(dv);
        setBrowsers(br);
      } else if (section === "users") {
        const q = `${filtersQuery}&page=${usersPage}&limit=25&sortBy=${sortBy}&sortOrder=${sortOrder}`;
        const data = await apiFetch(`/analytics/deep/users?${q}`).then((r) => parseAnalyticsJson<unknown>(r));
        setUsersData(data);
      } else if (section === "content") {
        const q = `${filtersQuery}&page=${contentPage}&limit=25`;
        const data = await apiFetch(`/analytics/deep/content?${q}`).then((r) => parseAnalyticsJson<unknown>(r));
        setContentData(data);
      } else if (section === "demographics") {
        const data = await apiFetch(`/analytics/deep/demographics?${filtersQuery}`).then((r) =>
          parseAnalyticsJson<unknown>(r),
        );
        setDemographics(data);
      } else if (section === "engagement") {
        const [fn, vel, ret] = await Promise.all([
          apiFetch(`/analytics/deep/funnel?${filtersQuery}`).then((r) => parseAnalyticsJson<FunnelStage[]>(r)),
          apiFetch(`/analytics/deep/velocity?${filtersQuery}`).then((r) => parseAnalyticsJson<VelocityRow[]>(r)),
          apiFetch(`/analytics/deep/retention?${filtersQuery}`).then((r) => parseAnalyticsJson<RetentionRow[]>(r)),
        ]);
        setFunnel(fn);
        setVelocity(vel);
        setRetention(ret);
      }

      if (section === "overview" || section === "demographics") {
        try {
          const geo = await apiFetch(`/analytics/deep/geo?${filtersQuery}`).then((r) =>
            parseAnalyticsJson<GeoAnalytics>(r),
          );
          if (geo.countries) {
            setCountries(geo.countries.map((c) => c.country).filter(Boolean));
          }
        } catch {
          /* filters may be invalid; ignore country list */
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load analytics data. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [section, filtersQuery, usersPage, contentPage, sortBy, sortOrder, setCountries]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
    setUsersPage(1);
  };

  return (
    <>
      {error && <ErrorBanner message={error} onDismiss={() => setError("")} className="mb-6" />}

      {loading && (
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-purple border-t-transparent" />
            <p className="text-sm text-[var(--color-text-muted)]">Loading analytics...</p>
          </div>
        </div>
      )}

      {!loading && (
        <>
          {section === "overview" && (
            <OverviewTab overview={overview} timeline={timeline} heatmap={heatmap} devices={devices} browsers={browsers} />
          )}
          {section === "users" && (
            <UsersTab
              data={usersData}
              filters={filtersRecord}
              onPageChange={setUsersPage}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
            />
          )}
          {section === "content" && (
            <ContentTab data={contentData} filters={filtersRecord} onPageChange={setContentPage} />
          )}
          {section === "demographics" && <DemographicsTab data={demographics} filters={filtersRecord} />}
          {section === "engagement" && (
            <EngagementTab funnel={funnel} velocity={velocity} retention={retention} />
          )}
        </>
      )}
    </>
  );
}
