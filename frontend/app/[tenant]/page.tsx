"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { useTenant } from "@/components/providers/tenant-context";
import { TenantLogo } from "@/components/ui/tenant-logo";
import { useI18n } from "@/lib/i18n/context";
import { AppBurgerHeader } from "@/components/ui/app-burger-header";
import { tenantAuthShellNavItems } from "@/lib/nav/burger-nav";

export default function TenantPortalPage() {
  const params = useParams();
  const slug = typeof params.tenant === "string" ? params.tenant : "";
  const { tenant, branding, isLoading, error } = useTenant();
  const { t } = useI18n();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-4 border-[var(--color-accent)] border-t-transparent animate-spin" />
          <p className="text-[var(--color-text-secondary)]">{t("portal.loadingAcademy")}</p>
        </div>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-bg-primary)] p-6">
        <div className="text-6xl mb-6">🎓</div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-3">
          {t("portal.academyNotFound")}
        </h1>
        <p className="text-[var(--color-text-secondary)] mb-8 text-center max-w-md">
          {t("portal.academyNotFoundDesc", { slug })}
        </p>
        <Link
          href="/"
          className="px-6 py-3 rounded-lg font-semibold text-white bg-gradient-to-br from-[#059669] to-[#10b981] hover:opacity-90 transition-opacity"
        >
          {t("portal.goToOmniLearn")}
        </Link>
      </div>
    );
  }

  const academyName = branding?.appName || tenant.name;
  const tagline = branding?.tagline || "Your enterprise learning platform";
  const primaryColor = branding?.primaryColor || "#059669";
  const portalNav = useMemo(() => tenantAuthShellNavItems(t, slug), [t, slug]);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg-primary)]">
      <AppBurgerHeader
        borderClassName="border-b border-[var(--color-bg-secondary)]"
        logoHref={`/${slug}`}
        logo={<TenantLogo logoUrl={tenant.logoUrl} name={academyName} size="md" />}
        title={academyName}
        items={portalNav}
      />

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl"
        >
          <TenantLogo logoUrl={tenant.logoUrl} name={academyName} size="lg" className="mx-auto mb-8" />

          <h1 className="text-4xl md:text-5xl font-bold text-[var(--color-text-primary)] mb-4">
            Welcome to{" "}
            <span style={{ color: primaryColor }}>{academyName}</span>
          </h1>

          <p className="text-lg text-[var(--color-text-secondary)] mb-10 leading-relaxed">
            {tagline}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link href={`/${slug}/signin`}>
              <button
                className="px-8 py-3.5 rounded-xl font-semibold text-white text-lg transition-opacity hover:opacity-90 shadow-lg"
                style={{ background: `linear-gradient(135deg, ${primaryColor}, ${branding?.accentColor || primaryColor}dd)` }}
              >
                {t("auth.getStarted")}
              </button>
            </Link>
            <Link href={`/${slug}/discover`}>
              <button className="px-8 py-3.5 rounded-xl font-semibold text-[var(--color-text-primary)] text-lg border-2 border-[var(--color-bg-secondary)] hover:border-[var(--color-accent)] transition-colors">
                {t("auth.browseCourses")}
              </button>
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-8 max-w-lg mx-auto">
            <Stat value={tenant.stats.learningPaths} label={t("portal.learningPaths")} />
            <Stat value={tenant.stats.domains} label={t("portal.domains")} />
            <Stat value={tenant.stats.users} label={t("portal.learners")} />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full"
        >
          <FeatureCard
            icon="📚"
            title={t("portal.structuredLearning")}
            description={t("portal.structuredLearningDesc")}
            color={primaryColor}
          />
          <FeatureCard
            icon="🏆"
            title={t("portal.earnCertificates")}
            description={t("portal.earnCertificatesDesc")}
            color={primaryColor}
          />
          <FeatureCard
            icon="📊"
            title={t("portal.trackProgress")}
            description={t("portal.trackProgressDesc")}
            color={primaryColor}
          />
        </motion.div>
      </main>

      <footer className="border-t border-[var(--color-bg-secondary)] px-6 py-6 text-center">
        <p className="text-sm text-[var(--color-text-secondary)]">
          {t("portal.poweredBy")}{" "}
          <Link href="/" className="font-medium hover:underline" style={{ color: primaryColor }}>
            OmniLearn
          </Link>
        </p>
      </footer>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl font-bold text-[var(--color-text-primary)]">{value}</div>
      <div className="text-sm text-[var(--color-text-secondary)] mt-1">{label}</div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  color,
}: {
  icon: string;
  title: string;
  description: string;
  color: string;
}) {
  return (
    <div className="card-brand p-6 text-center">
      <div className="text-3xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">{title}</h3>
      <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{description}</p>
      <div className="mt-4 h-1 w-12 mx-auto rounded-full" style={{ backgroundColor: color }} />
    </div>
  );
}
