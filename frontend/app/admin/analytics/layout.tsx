import { AnalyticsFiltersProvider } from "@/components/analytics/analytics-filters-context";
import { AnalyticsAdminShell } from "@/components/analytics/analytics-admin-shell";

export default function AdminAnalyticsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AnalyticsFiltersProvider>
      <AnalyticsAdminShell>{children}</AnalyticsAdminShell>
    </AnalyticsFiltersProvider>
  );
}
