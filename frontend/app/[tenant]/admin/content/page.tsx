"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTenant } from "@/components/providers/tenant-context";
import { TenantLogo } from "@/components/ui/tenant-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { NavToggles } from "@/components/ui/nav-toggles";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n/context";

type ContentItem = {
  id: string;
  title: string;
  type: string;
  durationMinutes?: number;
  createdAt: string;
};

export default function TenantContentAdminPage() {
  const params = useParams();
  const slug = typeof params.tenant === "string" ? params.tenant : "";
  const { t } = useI18n();
  const { tenant, branding, isLoading } = useTenant();

  const [content, setContent] = useState<ContentItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const academyName = branding?.appName || tenant?.name || "Academy";

  useEffect(() => {
    apiFetch("/content")
      .then((r) => r.json())
      .then((data) => setContent(Array.isArray(data) ? data : data?.items ?? []))
      .catch(() => [])
      .finally(() => setLoading(false));
  }, []);

  const filtered = content.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()));

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
          <span className="text-sm text-[var(--color-text-secondary)]">/ Content</span>
        </Link>
        <NavToggles />
      </header>

      <main className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{t("adminTenant.contentManagement")}</h1>
          <Link href={`/${slug}/admin/content/add`}><Button variant="primary">{t("adminTenant.addContent")}</Button></Link>
        </div>

        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("admin.searchContent")} className="mb-6 max-w-sm" />

        <Card>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-12 rounded-lg" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center text-[var(--color-text-secondary)]">No content found.</div>
            ) : (
              <div className="divide-y divide-[var(--color-bg-secondary)]">
                {filtered.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-sm text-[var(--color-text-primary)]">{item.title}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        {item.type.replace(/_/g, " ")} {item.durationMinutes ? `· ${item.durationMinutes} min` : ""}
                      </p>
                    </div>
                    <Link href={`/${slug}/content/${item.id}`}>
                      <Button variant="ghost" size="sm">{t("adminTenant.view")}</Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
