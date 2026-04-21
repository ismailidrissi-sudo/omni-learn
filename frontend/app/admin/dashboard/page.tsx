"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePermissions } from "@/hooks/use-permissions";
import { useI18n } from "@/lib/i18n/context";
import { Card, CardContent } from "@/components/ui/card";

type QuickAction = {
  labelKey: string;
  href: string;
  permission: string | null;
  icon: React.ReactNode;
  accentClass: string;
};

const ICON_APPROVALS = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const ICON_CONTENT = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
  </svg>
);
const ICON_PATHS = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503-10.053a23.955 23.955 0 00-11.006 0l-.503.109A1.867 1.867 0 003 9.127V18.75l.832-.555a23.927 23.927 0 0116.336 0L21 18.75V9.127c0-.89-.631-1.656-1.505-1.825l-.503-.109z" />
  </svg>
);
const ICON_USERS = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128H9m6 0a5.97 5.97 0 01-.786-3.07M9 19.128v-.003c0-1.113.285-2.16.786-3.07M9 19.128H3.75A2.25 2.25 0 011.5 16.878v-.003c0-1.032.38-1.974 1.006-2.695A4.126 4.126 0 017.5 9.75a4.126 4.126 0 014.994 4.43M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
  </svg>
);
const ICON_ANALYTICS = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>
);
const ICON_COMPANY = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5M3.75 3v18m4.5-18v18m4.5-18v18m4.5-18v18" />
  </svg>
);

function buildQuickActions(): QuickAction[] {
  return [
    {
      labelKey: "admin.sectionApprovals",
      href: "/admin/approvals",
      permission: "approvals:review",
      icon: ICON_APPROVALS,
      accentClass: "from-[var(--color-accent)] to-[var(--color-accent)]/70",
    },
    {
      labelKey: "admin.sectionContent",
      href: "/admin/content",
      permission: "courses:create",
      icon: ICON_CONTENT,
      accentClass: "from-[var(--color-accent)] to-[var(--color-accent)]/70",
    },
    {
      labelKey: "admin.sectionPaths",
      href: "/admin/paths",
      permission: "paths:create",
      icon: ICON_PATHS,
      accentClass: "from-[var(--color-accent)] to-[var(--color-accent)]/70",
    },
    {
      labelKey: "admin.sectionUsers",
      href: "/admin/analytics/users",
      permission: "users:manage",
      icon: ICON_USERS,
      accentClass: "from-[var(--color-accent)] to-[var(--color-accent)]/70",
    },
    {
      labelKey: "admin.sectionAnalytics",
      href: "/admin/analytics",
      permission: "admin:analytics",
      icon: ICON_ANALYTICS,
      accentClass: "from-[var(--color-accent)] to-[var(--color-accent)]/70",
    },
    {
      labelKey: "admin.sectionCompany",
      href: "/admin/company",
      permission: "companies:manage",
      icon: ICON_COMPANY,
      accentClass: "from-[var(--color-accent)] to-[var(--color-accent)]/70",
    },
  ];
}

export default function AdminDashboardPage() {
  const { resolveAdminLabel, permissions, loading } = usePermissions();
  const { t } = useI18n();
  const granted = useMemo(() => new Set(permissions), [permissions]);

  const quickActions = useMemo(() => {
    const all = buildQuickActions();
    return all.filter((a) => a.permission === null || granted.has(a.permission));
  }, [granted]);

  if (loading) {
    return (
      <main className="p-4 sm:p-6 md:p-10 max-w-4xl mx-auto animate-pulse">
        <div className="mb-8">
          <div className="h-8 w-48 bg-[var(--color-bg-secondary)] rounded mb-2" />
          <div className="h-4 w-72 bg-[var(--color-bg-secondary)] rounded" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-16 bg-[var(--color-bg-secondary)] rounded-xl" />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="p-4 sm:p-6 md:p-10 max-w-4xl mx-auto">
      {/* Welcome header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)] mb-2">
          {resolveAdminLabel()}
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          {t("admin.dashboardSubtitle")}
        </p>
      </div>

      {/* Quick action cards */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-secondary)] mb-4 px-1">
          {t("admin.quickLinks")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href} className="block group">
              <Card className="h-full transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${action.accentClass} text-white shadow-sm`}>
                    {action.icon}
                  </div>
                  <span className="text-sm font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors">
                    {t(action.labelKey)}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
