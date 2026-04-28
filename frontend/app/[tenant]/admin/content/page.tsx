"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTenant } from "@/components/providers/tenant-context";
import { TenantAdminBurgerHeader } from "@/components/ui/tenant-admin-burger-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n/context";
import { ExportButtons } from "@/components/ui/export-buttons";
import type { ColumnDef } from "@/lib/exports/list-export";

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

  const contentExportColumns = useMemo<ColumnDef<ContentItem>[]>(
    () => [
      { key: "title", header: "Title", accessor: (c) => c.title },
      { key: "type", header: "Type", accessor: (c) => c.type.replace(/_/g, " ") },
      {
        key: "duration",
        header: "Duration (min)",
        accessor: (c) => (c.durationMinutes != null ? String(c.durationMinutes) : "—"),
      },
      {
        key: "created",
        header: "Created",
        accessor: (c) => (c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "—"),
      },
    ],
    [],
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
        <div className="h-10 w-10 rounded-full border-4 border-[var(--color-accent)] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <TenantAdminBurgerHeader
        slug={slug}
        academyName={academyName}
        logoUrl={tenant?.logoUrl}
        contextSlot={<span className="text-sm text-[var(--color-text-secondary)]">/ Content</span>}
      />

      <main className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{t("adminTenant.contentManagement")}</h1>
          <div className="flex flex-wrap gap-2 items-center">
            <ExportButtons<ContentItem>
              rows={filtered}
              columns={contentExportColumns}
              tenantSlug={slug}
              filenameBase="content"
              pdfTitle={`${t("adminTenant.contentManagement")} — ${academyName}`}
              academyLogoUrl={tenant?.logoUrl}
            />
            <Link href={`/${slug}/admin/content/add`}><Button variant="primary">{t("adminTenant.addContent")}</Button></Link>
          </div>
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
