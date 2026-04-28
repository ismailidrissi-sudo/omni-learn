"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { useTenant } from "@/components/providers/tenant-context";
import { TenantAdminBurgerHeader } from "@/components/ui/tenant-admin-burger-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n/context";
import { ExportButtons } from "@/components/ui/export-buttons";
import type { ColumnDef } from "@/lib/exports/list-export";

type Path = {
  id: string;
  name: string;
  slug: string;
  difficulty?: string;
  isPublished: boolean;
  steps?: { id: string }[];
};

export default function TenantPathsAdminPage() {
  const params = useParams();
  const slug = typeof params.tenant === "string" ? params.tenant : "";
  const { t } = useI18n();
  const { tenant, branding, isLoading } = useTenant();

  const [paths, setPaths] = useState<Path[]>([]);
  const [loading, setLoading] = useState(true);

  const academyName = branding?.appName || tenant?.name || "Academy";

  useEffect(() => {
    if (!tenant?.id) return;
    apiFetch(`/learning-paths?tenantId=${tenant.id}&includeDraft=true`)
      .then((r) => r.json())
      .then((data) => setPaths(Array.isArray(data) ? data : []))
      .catch(() => [])
      .finally(() => setLoading(false));
  }, [tenant?.id]);

  const handleTogglePublish = async (path: Path) => {
    try {
      const res = await apiFetch(`/learning-paths/${path.id}`, {
        method: "PUT",
        body: JSON.stringify({ isPublished: !path.isPublished }),
      });
      if (res.ok) {
        setPaths((prev) =>
          prev.map((p) =>
            p.id === path.id ? { ...p, isPublished: !path.isPublished } : p
          )
        );
      }
    } catch {
      console.error("Failed to toggle publish status");
    }
  };

  const pathExportColumns = useMemo<ColumnDef<Path>[]>(
    () => [
      { key: "name", header: "Name", accessor: (p) => p.name },
      { key: "slug", header: "Slug", accessor: (p) => p.slug },
      { key: "difficulty", header: "Difficulty", accessor: (p) => p.difficulty ?? "—" },
      {
        key: "status",
        header: "Status",
        accessor: (p) => (p.isPublished ? t("adminTenant.published") : t("adminTenant.draft")),
      },
      { key: "steps", header: t("adminTenant.steps"), accessor: (p) => String(p.steps?.length ?? 0) },
    ],
    [t],
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
        contextSlot={
          <span className="text-sm text-[var(--color-text-secondary)]">/ {t("adminTenant.learningPaths")}</span>
        }
      />

      <main className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{t("adminTenant.learningPaths")}</h1>
          <div className="flex flex-wrap gap-2 items-center">
            <ExportButtons<Path>
              rows={paths}
              columns={pathExportColumns}
              tenantSlug={slug}
              filenameBase="learning-paths"
              pdfTitle={`${t("adminTenant.learningPaths")} — ${academyName}`}
              academyLogoUrl={tenant?.logoUrl}
            />
            <Button variant="primary">{t("adminTenant.createPath")}</Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>
        ) : paths.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">🛤️</div>
            <p className="text-[var(--color-text-secondary)]">{t("adminTenant.noPathsYet")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paths.map((path) => (
              <Card key={path.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-[var(--color-text-primary)]">{path.name}</h3>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${path.isPublished ? "bg-[var(--color-success-light)] text-[var(--color-success)]" : "bg-[var(--color-warning-light)] text-[var(--color-warning)]"}`}>
                          {path.isPublished ? "Published" : "Draft"}
                        </span>
                        {path.difficulty && (
                          <span className="text-xs text-[var(--color-text-secondary)]">{path.difficulty}</span>
                        )}
                        <span className="text-xs text-[var(--color-text-secondary)]">
                          {path.steps?.length ?? 0} {t("adminTenant.steps")}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant={path.isPublished ? "ghost" : "primary"}
                        size="sm"
                        onClick={() => handleTogglePublish(path)}
                      >
                        {path.isPublished ? t("admin.unpublish") : t("admin.publish")}
                      </Button>
                      <Button variant="ghost" size="sm">{t("common.edit")}</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
