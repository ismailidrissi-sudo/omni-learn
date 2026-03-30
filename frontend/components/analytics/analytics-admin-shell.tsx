"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LearnLogo } from "@/components/ui/learn-logo";
import { useI18n } from "@/lib/i18n/context";
import { AppBurgerHeader } from "@/components/ui/app-burger-header";
import { adminHubNavItems } from "@/lib/nav/burger-nav";
import { AnalyticsFilters } from "@/components/analytics/analytics-filters";
import { useAnalyticsFilters } from "@/components/analytics/analytics-filters-context";
import {
  BarChart3,
  Users,
  FileText,
  Globe,
  UserCircle,
  TrendingUp,
  Download,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo } from "react";

const NAV = [
  { href: "/admin/analytics/overview", label: "Overview", icon: BarChart3 },
  { href: "/admin/analytics/geography", label: "Geographic", icon: Globe },
  { href: "/admin/analytics/users", label: "Users", icon: Users },
  { href: "/admin/analytics/content", label: "Content", icon: FileText },
  { href: "/admin/analytics/demographics", label: "Demographics", icon: UserCircle },
  { href: "/admin/analytics/engagement", label: "Engagement", icon: TrendingUp },
  { href: "/admin/analytics/export", label: "Export", icon: Download },
];

export function AnalyticsAdminShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const adminNav = useMemo(() => adminHubNavItems(t), [t]);
  const pathname = usePathname();
  const {
    filters,
    setFilters,
    tenants,
    courses,
    domains,
    countries,
  } = useAnalyticsFilters();

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <AppBurgerHeader logoHref="/" logo={<LearnLogo size="md" variant="purple" />} items={adminNav} />

      <AnalyticsFilters
        filters={filters}
        onChange={setFilters}
        tenants={tenants}
        courses={courses}
        domains={domains}
        countries={countries}
      />

      <main className="max-w-7xl mx-auto px-6 py-6">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-6">Deep Analytics</h1>

        <div className="flex gap-0.5 mb-6 border-b border-[var(--color-bg-secondary)] overflow-x-auto">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                  active
                    ? "border-brand-purple text-brand-purple"
                    : "border-transparent text-[var(--color-text-muted)] hover:text-brand-purple hover:border-brand-purple/30"
                }`}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </div>

        {children}
      </main>
    </div>
  );
}
