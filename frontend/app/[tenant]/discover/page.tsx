"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTenant } from "@/components/providers/tenant-context";
import { useI18n } from "@/lib/i18n/context";
import { TenantLogo } from "@/components/ui/tenant-logo";
import { Input } from "@/components/ui/input";
import { AppBurgerHeader } from "@/components/ui/app-burger-header";
import { tenantLearnerNavItems } from "@/lib/nav/burger-nav";
import { useUser } from "@/lib/use-user";
import { apiFetch } from "@/lib/api";
import { learnerContentHref } from "@/lib/learner-content-href";

type ContentItem = {
  id: string;
  title: string;
  description?: string;
  type: string;
  durationMinutes?: number;
  domain?: { name: string } | null;
};

export default function TenantDiscoverPage() {
  const params = useParams();
  const slug = typeof params.tenant === "string" ? params.tenant : "";
  const { t } = useI18n();
  const { tenant, branding, isLoading: tenantLoading } = useTenant();
  const { user } = useUser();

  const [query, setQuery] = useState("");
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("");

  const academyName = branding?.appName || tenant?.name || "Academy";
  const primaryColor = branding?.primaryColor || "#059669";

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set("search", query);
    if (typeFilter) params.set("type", typeFilter);
    apiFetch(`/content?${params}`)
      .then((r) => r.json())
      .then((data) => setContent(Array.isArray(data) ? data : data?.items ?? []))
      .catch(() => setContent([]))
      .finally(() => setLoading(false));
  }, [query, typeFilter]);

  const tenantNav = useMemo(() => tenantLearnerNavItems(t, slug, user), [t, slug, user]);

  if (tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
        <div className="h-10 w-10 rounded-full border-4 border-[var(--color-accent)] border-t-transparent animate-spin" />
      </div>
    );
  }

  const types = ["COURSE", "MICRO_LEARNING", "PODCAST", "DOCUMENT", "VIDEO", "QUIZ_ASSESSMENT", "GAME"];

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <AppBurgerHeader
        borderClassName="border-b border-[var(--color-bg-secondary)]"
        logoHref={`/${slug}`}
        logo={<TenantLogo logoUrl={tenant?.logoUrl} name={academyName} size="md" />}
        title={academyName}
        items={tenantNav}
      />

      <main className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-6">
          {t("tenant.discoverContent")}
        </h1>

        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("tenant.searchContent")}
            className="flex-1"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-[var(--color-bg-secondary)] bg-white dark:bg-[#1a1e18] px-4 py-2 text-sm"
          >
            <option value="">{t("tenant.allTypes")}</option>
            {types.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="skeleton h-48 rounded-xl" />
            ))}
          </div>
        ) : content.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">🔍</div>
            <p className="text-[var(--color-text-secondary)]">{t("tenant.noContentFound")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {content.map((item) => (
              <Link key={item.id} href={learnerContentHref(item.type, item.id, { tenantSlug: slug })}>
                <div className="card-brand p-5 h-full hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="text-xs font-medium px-2 py-1 rounded-full text-white"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {item.type.replace(/_/g, " ")}
                    </span>
                    {item.durationMinutes && (
                      <span className="text-xs text-[var(--color-text-secondary)]">{item.durationMinutes} min</span>
                    )}
                  </div>
                  <h3 className="font-semibold text-[var(--color-text-primary)] mb-2 line-clamp-2">{item.title}</h3>
                  {item.description && (
                    <p className="text-sm text-[var(--color-text-secondary)] line-clamp-3">{item.description}</p>
                  )}
                  {item.domain && (
                    <p className="text-xs text-[var(--color-text-secondary)] mt-3">
                      {typeof item.domain === "string" ? item.domain : item.domain.name}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
