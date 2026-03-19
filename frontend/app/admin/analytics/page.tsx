"use client";

import { useState, useEffect, useMemo } from "react";
import { LearnLogo } from "@/components/ui/learn-logo";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { AppBurgerHeader } from "@/components/ui/app-burger-header";
import { adminHubNavItems } from "@/lib/nav/burger-nav";
import { apiFetch } from "@/lib/api";

type Overview = { enrollments: number; completions: number; eventsByType?: Record<string, number> };
type Event = { id: string; eventType: string; userId?: string; pathId?: string; createdAt: string };

export default function AnalyticsPage() {
  const { t } = useI18n();
  const adminNav = useMemo(() => adminHubNavItems(t), [t]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [tenantId] = useState("");
  const [predictive, setPredictive] = useState<{
    atRiskEnrollments: { enrollmentId: string; pathName: string; progressPct: number; riskScore: number; reason: string }[];
    predictedCompletionRate: number;
    totalActive: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    const q = tenantId ? `?tenantId=${tenantId}` : "";
    Promise.all([
      apiFetch(`/analytics/overview${q}`).then((r) => r.json()).then(setOverview),
      apiFetch(`/analytics/events${q}`).then((r) => r.json()).then(setEvents),
      apiFetch(`/intelligence/predictive${q}`).then((r) => r.json()).then(setPredictive),
    ])
      .catch(() => setError("Failed to load analytics data. Please try again later."))
      .finally(() => setLoading(false));
  }, [tenantId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-green border-t-transparent" />
          <p className="text-sm text-[var(--color-text-muted)]">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <AppBurgerHeader logoHref="/" logo={<LearnLogo size="md" variant="purple" />} items={adminNav} />

      <main className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-brand-grey-dark mb-6">{t("admin.analyticsDashboard")}</h1>

        {error && <ErrorBanner message={error} onDismiss={() => setError("")} className="mb-6" />}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-brand-grey">{t("admin.enrollments")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-brand-purple">{overview?.enrollments ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-brand-grey">{t("admin.completions")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-brand-purple">{overview?.completions ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-brand-grey">{t("admin.completionRate")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-brand-purple">
                {overview?.enrollments
                  ? Math.round(((overview.completions ?? 0) / overview.enrollments) * 100)
                  : 0}%
              </p>
            </CardContent>
          </Card>
        </div>

        {predictive && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>{t("admin.predictiveAnalytics")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-brand-grey">{t("admin.predictedCompletionRate")}</p>
                  <p className="text-2xl font-bold text-brand-purple">{predictive.predictedCompletionRate}%</p>
                </div>
                <div>
                  <p className="text-sm text-brand-grey">{t("admin.activeEnrollments")}</p>
                  <p className="text-2xl font-bold text-brand-purple">{predictive.totalActive}</p>
                </div>
              </div>
              {predictive.atRiskEnrollments.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">{t("admin.atRiskEnrollments")}</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {predictive.atRiskEnrollments.map((r) => (
                      <div key={r.enrollmentId} className="flex justify-between text-sm py-2 border-b border-brand-grey-light/50">
                        <span>{r.pathName} ({r.progressPct}%)</span>
                        <span className="text-brand-grey-dark">{r.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.recentEvents")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {events.length === 0 ? (
                <p className="text-brand-grey text-sm">{t("admin.noEvents")}</p>
              ) : (
                events.map((e) => (
                  <div key={e.id} className="flex justify-between text-sm py-2 border-b border-brand-grey-light/50">
                    <span className="font-medium">{e.eventType}</span>
                    <span className="text-brand-grey">{new Date(e.createdAt).toLocaleString()}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
