"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useTenant } from "@/components/providers/tenant-context";
import { useI18n } from "@/lib/i18n/context";
import { TenantLogo } from "@/components/ui/tenant-logo";
import { NavToggles } from "@/components/ui/nav-toggles";
import { useUser } from "@/lib/use-user";

const adminSections = [
  { href: "branding", icon: "🎨", titleKey: "adminTenant.brandingStudio", descKey: "adminTenant.brandingStudioDesc" },
  { href: "users", icon: "👥", titleKey: "adminTenant.userManagement", descKey: "adminTenant.userManagementDesc" },
  { href: "groups", icon: "🏢", titleKey: "adminTenant.groupsDepartments", descKey: "adminTenant.groupsDepartmentsDesc" },
  { href: "compliance", icon: "📋", titleKey: "adminTenant.complianceTraining", descKey: "adminTenant.complianceTrainingDesc" },
  { href: "team", icon: "📊", titleKey: "adminTenant.managerDashboard", descKey: "adminTenant.managerDashboardDesc" },
  { href: "sso", icon: "🔐", titleKey: "adminTenant.ssoConfig", descKey: "adminTenant.ssoConfigDesc" },
  { href: "content", icon: "📚", titleKey: "adminTenant.contentManagement", descKey: "adminTenant.contentManagementDesc" },
  { href: "domains", icon: "🗂️", titleKey: "adminTenant.learningDomains", descKey: "adminTenant.domainDescription" },
  { href: "paths", icon: "🛤️", titleKey: "adminTenant.learningPaths", descKey: "adminTenant.learningPathsDesc" },
  { href: "certificates", icon: "📜", titleKey: "adminTenant.certificateTemplates", descKey: "adminTenant.certDescription" },
  { href: "analytics", icon: "📈", titleKey: "adminTenant.analytics", descKey: "adminTenant.analyticsDesc" },
];

export default function TenantAdminPage() {
  const params = useParams();
  const slug = typeof params.tenant === "string" ? params.tenant : "";
  const { t } = useI18n();
  const { tenant, branding, isLoading } = useTenant();
  const { loading: userLoading } = useUser();

  const academyName = branding?.appName || tenant?.name || "Academy";

  if (isLoading || userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
        <div className="h-10 w-10 rounded-full border-4 border-[var(--color-accent)] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <header className="border-b border-[var(--color-bg-secondary)] px-6 py-4 flex justify-between items-center">
        <Link href={`/${slug}`} className="flex items-center gap-3">
          <TenantLogo logoUrl={tenant?.logoUrl} name={academyName} size="md" />
          <span className="text-lg font-bold text-[var(--color-text-primary)]">{academyName}</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href={`/${slug}/learn`} className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
            {t("tenant.backToLearning")}
          </Link>
          <NavToggles />
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
          {t("adminTenant.administration")}
        </h1>
        <p className="text-[var(--color-text-secondary)] mb-8">
          {t("adminTenant.manageAcademy", { name: academyName })}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {adminSections.map((section) => (
            <Link key={section.href} href={`/${slug}/admin/${section.href}`}>
              <div className="card-brand p-6 h-full hover:shadow-md transition-all cursor-pointer group">
                <div className="text-3xl mb-3">{section.icon}</div>
                <h3 className="font-semibold text-[var(--color-text-primary)] mb-1 group-hover:text-[var(--color-accent)] transition-colors">
                  {t(section.titleKey)}
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)]">{t(section.descKey)}</p>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
