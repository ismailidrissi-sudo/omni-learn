"use client";

import { useState, useEffect, useMemo } from "react";
// import Link from "next/link";
import { useParams } from "next/navigation";
import { useTenant } from "@/components/providers/tenant-context";
import { TenantAdminBurgerHeader } from "@/components/ui/tenant-admin-burger-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
// import { NavToggles } from "@/components/ui/nav-toggles";
import { apiFetch } from "@/lib/api";
import { toast } from "@/lib/use-toast";
import { useI18n } from "@/lib/i18n/context";
import { ExportButtons } from "@/components/ui/export-buttons";
import type { ColumnDef } from "@/lib/exports/list-export";

type UserGroup = {
  id: string;
  name: string;
  slug: string;
  type: string;
  description?: string;
  _count?: { members: number };
};

export default function GroupsPage() {
  const params = useParams();
  const slug = typeof params.tenant === "string" ? params.tenant : "";
  const { t } = useI18n();
  const { tenant, branding, isLoading } = useTenant();

  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGroup, setNewGroup] = useState({ name: "", type: "CUSTOM", description: "" });
  const [creating, setCreating] = useState(false);

  const academyName = branding?.appName || tenant?.name || "Academy";

  const fetchGroups = () => {
    if (!tenant) return;
    setLoading(true);
    apiFetch(`/company/tenants/${tenant.id}/groups`)
      .then((r) => r.json())
      .then((data) => setGroups(Array.isArray(data) ? data : []))
      .catch(() => setGroups([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (tenant) fetchGroups();
  }, [tenant?.id]);

  const groupExportColumns = useMemo<ColumnDef<UserGroup>[]>(
    () => [
      { key: "name", header: t("adminTenant.groupName"), accessor: (g) => g.name },
      { key: "type", header: t("adminTenant.type"), accessor: (g) => g.type },
      {
        key: "description",
        header: t("adminTenant.description"),
        accessor: (g) => g.description ?? "—",
      },
      {
        key: "members",
        header: t("adminTenant.members"),
        accessor: (g) => String(g._count?.members ?? 0),
      },
    ],
    [t],
  );

  const createGroup = async () => {
    if (!tenant || !newGroup.name.trim()) return;
    setCreating(true);
    try {
      const groupSlug = newGroup.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      await apiFetch(`/company/tenants/${tenant.id}/groups`, {
        method: "POST",
        body: JSON.stringify({ ...newGroup, slug: groupSlug, tenantId: tenant.id }),
      });
      setNewGroup({ name: "", type: "CUSTOM", description: "" });
      toast("Group created", "success");
      fetchGroups();
    } catch {
      toast("Failed to create group", "error");
    } finally {
      setCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
        <div className="h-10 w-10 rounded-full border-4 border-[var(--color-accent)] border-t-transparent animate-spin" />
      </div>
    );
  }

  const groupTypes = ["COHORT", "DEPARTMENT", "ROLE", "CUSTOM"];

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <TenantAdminBurgerHeader
        slug={slug}
        academyName={academyName}
        logoUrl={tenant?.logoUrl}
        contextSlot={<span className="text-sm text-[var(--color-text-secondary)]">/ {t("adminTenant.groups")}</span>}
      />

      <main className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Groups & Departments</h1>
          <ExportButtons<UserGroup>
            rows={groups}
            columns={groupExportColumns}
            tenantSlug={slug}
            filenameBase="groups"
            pdfTitle={`${t("adminTenant.groupsDepartments")} — ${academyName}`}
            academyLogoUrl={tenant?.logoUrl}
          />
        </div>

        <Card className="mb-6">
          <CardHeader><CardTitle>Create Group</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Input
                value={newGroup.name}
                onChange={(e) => setNewGroup((g) => ({ ...g, name: e.target.value }))}
                placeholder={t("adminTenant.groupName")}
                className="flex-1 min-w-[200px]"
              />
              <select
                value={newGroup.type}
                onChange={(e) => setNewGroup((g) => ({ ...g, type: e.target.value }))}
                className="rounded-lg border border-[var(--color-bg-secondary)] bg-white dark:bg-[#1a1e18] px-3 py-2 text-sm"
              >
                {groupTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <Input
                value={newGroup.description}
                onChange={(e) => setNewGroup((g) => ({ ...g, description: e.target.value }))}
                placeholder={t("adminTenant.description")}
                className="flex-1 min-w-[200px]"
              />
              <Button variant="primary" onClick={createGroup} disabled={creating}>
                {creating ? t("common.loading") : t("common.create")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">🏢</div>
            <p className="text-[var(--color-text-secondary)]">{t("adminTenant.noGroupsYet")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <Card key={group.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <h3 className="font-semibold text-[var(--color-text-primary)]">{group.name}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs px-2 py-0.5 rounded bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]">
                        {group.type}
                      </span>
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        {group._count?.members ?? 0} {t("adminTenant.members")}
                      </span>
                      {group.description && (
                        <span className="text-xs text-[var(--color-text-secondary)]">{group.description}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm">{t("adminTenant.manageMembers")}</Button>
                    <Button variant="ghost" size="sm">{t("adminTenant.assignPath")}</Button>
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
