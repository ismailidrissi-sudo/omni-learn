"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTenant } from "@/components/providers/tenant-context";
import { useI18n } from "@/lib/i18n/context";
import { TenantLogo } from "@/components/ui/tenant-logo";
import { NavToggles } from "@/components/ui/nav-toggles";
import { apiFetch } from "@/lib/api";

type ContentDetail = {
  id: string;
  title: string;
  description?: string;
  type: string;
  durationMinutes?: number;
  metadata?: Record<string, unknown>;
  domain?: { name: string } | null;
};

export default function TenantContentPage() {
  const params = useParams();
  const slug = typeof params.tenant === "string" ? params.tenant : "";
  const contentId = typeof params.id === "string" ? params.id : "";
  const { t } = useI18n();
  const { tenant, branding, isLoading: tenantLoading } = useTenant();

  const [content, setContent] = useState<ContentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const academyName = branding?.appName || tenant?.name || "Academy";

  useEffect(() => {
    if (!contentId) return;
    setLoading(true);
    apiFetch(`/content/${contentId}`)
      .then((r) => r.json())
      .then(setContent)
      .catch(() => setContent(null))
      .finally(() => setLoading(false));
  }, [contentId]);

  if (tenantLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
        <div className="h-10 w-10 rounded-full border-4 border-[var(--color-accent)] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!content) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-bg-primary)]">
        <div className="text-4xl mb-4">📄</div>
        <h1 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">{t("content.contentNotFound")}</h1>
        <Link href={`/${slug}/discover`} className="text-[var(--color-accent)] hover:underline text-sm">
          {t("content.backToDiscover")}
        </Link>
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
        <NavToggles />
      </header>

      <main className="max-w-4xl mx-auto p-6">
        <Link href={`/${slug}/discover`} className="text-sm text-[var(--color-accent)] hover:underline mb-4 inline-block">
          &larr; {t("content.backToDiscover")}
        </Link>

        <div className="card-brand p-8">
          <div className="flex items-center gap-3 mb-4">
            <span
              className="text-xs font-medium px-3 py-1 rounded-full text-white"
              style={{ backgroundColor: branding?.primaryColor || "#059669" }}
            >
              {content.type.replace(/_/g, " ")}
            </span>
            {content.durationMinutes && (
              <span className="text-sm text-[var(--color-text-secondary)]">{content.durationMinutes} min</span>
            )}
            {content.domain && (
              <span className="text-sm text-[var(--color-text-secondary)]">
                {typeof content.domain === "string" ? content.domain : content.domain.name}
              </span>
            )}
          </div>

          <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-4">{content.title}</h1>

          {content.description && (
            <p className="text-[var(--color-text-secondary)] leading-relaxed mb-6">{content.description}</p>
          )}

          <div className="border-t border-[var(--color-bg-secondary)] pt-6 mt-6">
            <p className="text-sm text-[var(--color-text-secondary)]">
              {t("content.contentViewerHint")}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
