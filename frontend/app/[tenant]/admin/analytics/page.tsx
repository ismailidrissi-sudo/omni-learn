"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTenant } from "@/components/providers/tenant-context";
import { TenantLogo } from "@/components/ui/tenant-logo";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { NavToggles } from "@/components/ui/nav-toggles";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n/context";

type OverviewStats = {
  totalEvents?: number;
  uniqueUsers?: number;
  avgSessionDuration?: number;
  topContent?: { title: string; views: number }[];
};

export default function TenantAnalyticsPage() {
  const params = useParams();
  const slug = typeof params.tenant === "string" ? params.tenant : "";
  const { t } = useI18n();
  const { tenant, branding, isLoading } = useTenant();

  const [overview, setOverview] = useState<OverviewStats>({});
  const [loading, setLoading] = useState(true);

  const academyName = branding?.appName || tenant?.name || "Academy";
  const primaryColor = branding?.primaryColor || "#059669";

  useEffect(() => {
    apiFetch("/analytics/overview")
      .then((r) => r.json())
      .then(setOverview)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
        <div className="h-10 w-10 rounded-full border-4 border-[var(--color-accent)] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <header className="border-b border-[var(--color-bg-secondary)] px-6 py-4 flex justify-between items-center">
        <Link href={`/${slug}/admin`} className="flex items-center gap-3">
          <TenantLogo logoUrl={tenant?.logoUrl} name={academyName} size="md" />
          <span className="text-lg font-bold text-[var(--color-text-primary)]">{academyName}</span>
          <span className="text-sm text-[var(--color-text-secondary)]">/ {t("adminTenant.analytics")}</span>
        </Link>
        <NavToggles />
      </header>

      <main className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-6">{t("adminTenant.analytics")}</h1>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {[1, 2, 3].map((i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="card-brand p-6 text-center">
                <div className="text-3xl font-bold" style={{ color: primaryColor }}>{overview.totalEvents ?? 0}</div>
                <div className="text-sm text-[var(--color-text-secondary)] mt-1">Total Events</div>
              </div>
              <div className="card-brand p-6 text-center">
                <div className="text-3xl font-bold" style={{ color: primaryColor }}>{overview.uniqueUsers ?? 0}</div>
                <div className="text-sm text-[var(--color-text-secondary)] mt-1">{t("adminTenant.activeLearners")}</div>
              </div>
              <div className="card-brand p-6 text-center">
                <div className="text-3xl font-bold" style={{ color: primaryColor }}>
                  {overview.avgSessionDuration ? `${Math.round(overview.avgSessionDuration)}m` : "—"}
                </div>
                <div className="text-sm text-[var(--color-text-secondary)] mt-1">Avg Session</div>
              </div>
            </div>

            <Card>
              <CardHeader><CardTitle>{t("adminTenant.topContent")}</CardTitle></CardHeader>
              <CardContent>
                {overview.topContent && overview.topContent.length > 0 ? (
                  <div className="space-y-3">
                    {overview.topContent.map((item, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-sm text-[var(--color-text-primary)]">{item.title}</span>
                        <span className="text-sm font-medium" style={{ color: primaryColor }}>{item.views} views</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--color-text-secondary)]">{t("adminTenant.noAnalytics")}</p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
