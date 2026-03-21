"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { LearnLogo } from "@/components/ui/learn-logo";
import { useI18n } from "@/lib/i18n/context";
import { ErrorBanner } from "@/components/ui/error-banner";
import { AppBurgerHeader } from "@/components/ui/app-burger-header";
import { adminHubNavItems } from "@/lib/nav/burger-nav";
import { apiFetch } from "@/lib/api";
import { AnalyticsFilters } from "@/components/analytics/analytics-filters";
import { OverviewTab } from "@/components/analytics/overview-tab";
import { UsersTab } from "@/components/analytics/users-tab";
import { ContentTab } from "@/components/analytics/content-tab";
import { GeoTab } from "@/components/analytics/geo-tab";
import { DemographicsTab } from "@/components/analytics/demographics-tab";
import { EngagementTab } from "@/components/analytics/engagement-tab";
import { BarChart3, Users, FileText, Globe, UserCircle, TrendingUp } from "lucide-react";

type Filters = {
  from: string;
  to: string;
  tenantId: string;
  courseId: string;
  domainId: string;
  country: string;
  deviceType: string;
  gender: string;
  search: string;
};

const TABS = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "users", label: "Users", icon: Users },
  { id: "content", label: "Content", icon: FileText },
  { id: "geo", label: "Geography", icon: Globe },
  { id: "demographics", label: "Demographics", icon: UserCircle },
  { id: "engagement", label: "Engagement", icon: TrendingUp },
];

const DEFAULT_FILTERS: Filters = {
  from: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
  to: new Date().toISOString().slice(0, 10),
  tenantId: "",
  courseId: "",
  domainId: "",
  country: "",
  deviceType: "",
  gender: "",
  search: "",
};

export default function DeepAnalyticsPage() {
  const { t } = useI18n();
  const adminNav = useMemo(() => adminHubNavItems(t), [t]);

  const [activeTab, setActiveTab] = useState("overview");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filter options
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [domains] = useState<{ id: string; name: string }[]>([]);
  const [countries, setCountries] = useState<string[]>([]);

  type OverviewData = {
    totalUsers: number; activeUsers: number; newUsers: number; totalSessions: number;
    avgSessionDuration: number; totalPageViews: number; totalEnrollments: number;
    totalCompletions: number; completionRate: number; totalLearningHours: number;
  };
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [timeline, setTimeline] = useState<{ date: string; sessions: number }[]>([]);
  const [heatmap, setHeatmap] = useState<number[][]>(Array.from({ length: 7 }, () => Array(24).fill(0)));
  const [devices, setDevices] = useState<{ deviceType: string; count: number; percentage: number }[]>([]);
  const [browsers, setBrowsers] = useState<{ browsers: { name: string; count: number }[]; operatingSystems: { name: string; count: number }[] }>({ browsers: [], operatingSystems: [] });
  const [usersData, setUsersData] = useState<any>(null);
  const [contentData, setContentData] = useState<any>(null);
  const [geoData, setGeoData] = useState<any>(null);
  const [demographics, setDemographics] = useState<any>(null);
  const [funnel, setFunnel] = useState<{ stage: string; count: number }[]>([]);
  const [velocity, setVelocity] = useState<{ courseId: string; title: string; avgDaysToComplete: number; completions: number }[]>([]);
  const [retention, setRetention] = useState<{ cohort: string; months: { month: string; users: number }[] }[]>([]);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  // Pagination & sort
  const [usersPage, setUsersPage] = useState(1);
  const [contentPage, setContentPage] = useState(1);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const filtersQuery = useMemo(() => {
    const p = new URLSearchParams();
    if (filters.from) p.set("from", filters.from);
    if (filters.to) p.set("to", filters.to);
    if (filters.tenantId) p.set("tenantId", filters.tenantId);
    if (filters.courseId) p.set("courseId", filters.courseId);
    if (filters.domainId) p.set("domainId", filters.domainId);
    if (filters.country) p.set("country", filters.country);
    if (filters.deviceType) p.set("deviceType", filters.deviceType);
    if (filters.gender) p.set("gender", filters.gender);
    if (filters.search) p.set("search", filters.search);
    return p.toString();
  }, [filters]);

  const filtersRecord = useMemo(() => {
    const r: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(filters)) {
      if (v) r[k] = v;
    }
    return r;
  }, [filters]);

  // Load filter options once
  useEffect(() => {
    Promise.all([
      apiFetch("/company/tenants").then((r) => r.ok ? r.json() : []).catch(() => []),
      apiFetch("/content?type=COURSE&limit=100").then((r) => r.ok ? r.json() : []).catch(() => []),
    ]).then(([t, c]) => {
      if (Array.isArray(t)) setTenants(t.map((x: Record<string, string>) => ({ id: x.id, name: x.name })));
      if (Array.isArray(c)) setCourses(c.map((x: Record<string, string>) => ({ id: x.id, title: x.title })));
    });
  }, []);

  // Fetch data based on active tab and filters
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      if (activeTab === "overview") {
        const [ov, tl, hm, dv, br] = await Promise.all([
          apiFetch(`/analytics/deep/overview?${filtersQuery}`).then((r) => r.json()),
          apiFetch(`/analytics/deep/timeline?${filtersQuery}`).then((r) => r.json()),
          apiFetch(`/analytics/deep/heatmap?${filtersQuery}`).then((r) => r.json()),
          apiFetch(`/analytics/deep/devices?${filtersQuery}`).then((r) => r.json()),
          apiFetch(`/analytics/deep/browsers?${filtersQuery}`).then((r) => r.json()),
        ]);
        setOverview(ov);
        setTimeline(tl);
        setHeatmap(hm);
        setDevices(dv);
        setBrowsers(br);
      } else if (activeTab === "users") {
        const q = `${filtersQuery}&page=${usersPage}&limit=25&sortBy=${sortBy}&sortOrder=${sortOrder}`;
        const data = await apiFetch(`/analytics/deep/users?${q}`).then((r) => r.json());
        setUsersData(data);
      } else if (activeTab === "content") {
        const q = `${filtersQuery}&page=${contentPage}&limit=25`;
        const data = await apiFetch(`/analytics/deep/content?${q}`).then((r) => r.json());
        setContentData(data);
      } else if (activeTab === "geo") {
        const data = await apiFetch(`/analytics/deep/geo?${filtersQuery}`).then((r) => r.json());
        setGeoData(data);
        if (data.countries) {
          setCountries(data.countries.map((c: { country: string }) => c.country).filter(Boolean));
        }
      } else if (activeTab === "demographics") {
        const data = await apiFetch(`/analytics/deep/demographics?${filtersQuery}`).then((r) => r.json());
        setDemographics(data);
      } else if (activeTab === "engagement") {
        const [fn, vel, ret] = await Promise.all([
          apiFetch(`/analytics/deep/funnel?${filtersQuery}`).then((r) => r.json()),
          apiFetch(`/analytics/deep/velocity?${filtersQuery}`).then((r) => r.json()),
          apiFetch(`/analytics/deep/retention?${filtersQuery}`).then((r) => r.json()),
        ]);
        setFunnel(fn);
        setVelocity(vel);
        setRetention(ret);
      }
    } catch {
      setError("Failed to load analytics data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [activeTab, filtersQuery, usersPage, contentPage, sortBy, sortOrder]);

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
    <div className="min-h-screen bg-white dark:bg-[#0f1510]">
      <AppBurgerHeader logoHref="/" logo={<LearnLogo size="md" variant="purple" />} items={adminNav} />

      <AnalyticsFilters
        filters={filters}
        onChange={(f) => { setFilters(f); setUsersPage(1); setContentPage(1); }}
        tenants={tenants}
        courses={courses}
        domains={domains}
        countries={countries}
      />

      <main className="max-w-7xl mx-auto px-6 py-6">
        <h1 className="text-2xl font-bold text-brand-grey-dark mb-6">Deep Analytics</h1>

        {error && <ErrorBanner message={error} onDismiss={() => setError("")} className="mb-6" />}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-brand-grey-light/30 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  active
                    ? "border-brand-purple text-brand-purple"
                    : "border-transparent text-brand-grey hover:text-brand-purple/70 hover:border-brand-purple/30"
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-purple border-t-transparent" />
              <p className="text-sm text-brand-grey">Loading analytics...</p>
            </div>
          </div>
        )}

        {/* Tab content */}
        {!loading && (
          <>
            {activeTab === "overview" && (
              <OverviewTab overview={overview} timeline={timeline} heatmap={heatmap} devices={devices} browsers={browsers} />
            )}
            {activeTab === "users" && (
              <UsersTab
                data={usersData}
                filters={filtersRecord}
                onPageChange={setUsersPage}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={handleSort}
              />
            )}
            {activeTab === "content" && (
              <ContentTab data={contentData} filters={filtersRecord} onPageChange={setContentPage} />
            )}
            {activeTab === "geo" && (
              <GeoTab data={geoData} filters={filtersRecord} />
            )}
            {activeTab === "demographics" && (
              <DemographicsTab data={demographics} filters={filtersRecord} />
            )}
            {activeTab === "engagement" && (
              <EngagementTab funnel={funnel} velocity={velocity} retention={retention} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
