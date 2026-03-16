"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTenant } from "@/components/providers/tenant-context";
import { useI18n } from "@/lib/i18n/context";
import { TenantLogo } from "@/components/ui/tenant-logo";
import { Button } from "@/components/ui/button";
import { NavToggles } from "@/components/ui/nav-toggles";
import { apiFetch } from "@/lib/api";

type Channel = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  _count?: { topics: number };
};

export default function TenantForumPage() {
  const params = useParams();
  const slug = typeof params.tenant === "string" ? params.tenant : "";
  const { t } = useI18n();
  const { tenant, branding, isLoading } = useTenant();

  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  const academyName = branding?.appName || tenant?.name || "Academy";

  useEffect(() => {
    apiFetch("/forum/channels")
      .then((r) => r.json())
      .then((data) => setChannels(Array.isArray(data) ? data : []))
      .catch(() => [])
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
        <Link href={`/${slug}`} className="flex items-center gap-3">
          <TenantLogo logoUrl={tenant?.logoUrl} name={academyName} size="md" />
          <span className="text-lg font-bold text-[var(--color-text-primary)]">{academyName}</span>
        </Link>
        <nav className="flex items-center gap-3">
          <Link href={`/${slug}/learn`}><Button variant="ghost" size="sm">{t("tenant.learn")}</Button></Link>
          <Link href={`/${slug}/discover`}><Button variant="ghost" size="sm">{t("tenant.discover")}</Button></Link>
          <Link href={`/${slug}/forum`}><Button variant="primary" size="sm">{t("tenant.forum")}</Button></Link>
          <Link href={`/${slug}/admin`}><Button variant="ghost" size="sm">{t("tenant.admin")}</Button></Link>
          <div className="pl-3 ml-3 border-l border-[var(--color-bg-secondary)]">
            <NavToggles />
          </div>
        </nav>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-6">{t("tenant.communityForum")}</h1>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
          </div>
        ) : channels.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">💬</div>
            <p className="text-[var(--color-text-secondary)]">{t("tenant.noForumChannels")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {channels.map((channel) => (
              <Link key={channel.id} href={`/forum?channel=${channel.id}`}>
                <div className="card-brand p-5 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-[var(--color-text-primary)]">{channel.name}</h3>
                      {channel.description && (
                        <p className="text-sm text-[var(--color-text-secondary)] mt-1">{channel.description}</p>
                      )}
                    </div>
                    <span className="text-sm text-[var(--color-text-secondary)]">
                      {channel._count?.topics ?? 0} {t("tenant.topics")}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
