"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useTenant } from "@/components/providers/tenant-context";
import { TenantAdminBurgerHeader } from "@/components/ui/tenant-admin-burger-header";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n/context";
import { ExportButtons } from "@/components/ui/export-buttons";
import type { ColumnDef } from "@/lib/exports/list-export";

type TeamMember = {
  userId: string;
  name: string;
  email: string;
  enrollments: number;
  completedPct: number;
};

export default function ManagerDashboardPage() {
  const params = useParams();
  const slug = typeof params.tenant === "string" ? params.tenant : "";
  const { t } = useI18n();
  const { tenant, branding, isLoading } = useTenant();

  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const academyName = branding?.appName || tenant?.name || "Academy";
  const primaryColor = branding?.primaryColor || "#059669";

  useEffect(() => {
    if (!tenant) return;
    setLoading(true);
    apiFetch(`/company/tenants/${tenant.id}/analytics`)
      .then((r) => r.json())
      .then((data) => setTeam(Array.isArray(data) ? data : []))
      .catch(() => setTeam([]))
      .finally(() => setLoading(false));
  }, [tenant?.id]);

  const filtered = team.filter((m) => {
    const q = search.toLowerCase();
    return m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
  });

  const avgCompletion = team.length > 0
    ? Math.round(team.reduce((sum, m) => sum + m.completedPct, 0) / team.length)
    : 0;
  const totalEnrollments = team.reduce((sum, m) => sum + m.enrollments, 0);
  const overdueCount = team.filter((m) => m.enrollments > 0 && m.completedPct < 50).length;

  const teamExportColumns: ColumnDef<TeamMember>[] = [
    { key: "name", header: t("adminTenant.name"), accessor: (m) => m.name },
    { key: "email", header: "Email", accessor: (m) => m.email },
    { key: "enrollments", header: "Enrollments", accessor: (m) => m.enrollments },
    { key: "completion", header: t("adminTenant.avgCompletion"), accessor: (m) => `${m.completedPct}%` },
  ];

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
        contextSlot={<span className="text-sm text-[var(--color-text-secondary)]">/ {t("adminTenant.team")}</span>}
      />

      <main className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{t("adminTenant.managerDashboard")}</h1>
          <ExportButtons<TeamMember>
            rows={filtered}
            columns={teamExportColumns}
            tenantSlug={slug}
            filenameBase="team"
            pdfTitle={`${t("adminTenant.managerDashboard")} — ${academyName}`}
            academyLogoUrl={tenant?.logoUrl}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="card-brand p-4 text-center">
            <div className="text-2xl font-bold text-[var(--color-text-primary)]">{team.length}</div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-1">{t("adminTenant.teamMembers")}</div>
          </div>
          <div className="card-brand p-4 text-center">
            <div className="text-2xl font-bold text-[var(--color-text-primary)]">{totalEnrollments}</div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-1">Total Enrollments</div>
          </div>
          <div className="card-brand p-4 text-center">
            <div className="text-2xl font-bold" style={{ color: primaryColor }}>{avgCompletion}%</div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-1">{t("adminTenant.avgCompletion")}</div>
          </div>
          <div className={`card-brand p-4 text-center ${overdueCount > 0 ? "border-[var(--color-warning)]" : ""}`}>
            <div className={`text-2xl font-bold ${overdueCount > 0 ? "text-[var(--color-warning)]" : "text-[var(--color-text-primary)]"}`}>
              {overdueCount}
            </div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-1">{t("adminTenant.needsAttention")}</div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("adminTenant.searchTeam")}
                className="max-w-sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-14 rounded-lg" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center text-[var(--color-text-secondary)]">No team members found.</div>
            ) : (
              <div className="divide-y divide-[var(--color-bg-secondary)]">
                <div className="grid grid-cols-12 gap-4 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  <div className="col-span-4">{t("adminTenant.name")}</div>
                  <div className="col-span-3">Email</div>
                  <div className="col-span-2 text-center">Enrollments</div>
                  <div className="col-span-3">Progress</div>
                </div>
                {filtered.map((member) => (
                  <div key={member.userId} className="grid grid-cols-12 gap-4 py-3 items-center text-sm">
                    <div className="col-span-4 font-medium text-[var(--color-text-primary)]">{member.name}</div>
                    <div className="col-span-3 text-[var(--color-text-secondary)] truncate">{member.email}</div>
                    <div className="col-span-2 text-center text-[var(--color-text-primary)]">{member.enrollments}</div>
                    <div className="col-span-3 flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-[var(--color-bg-secondary)] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${member.completedPct}%`,
                            backgroundColor: member.completedPct >= 80 ? "var(--color-success)" :
                              member.completedPct >= 50 ? primaryColor : "var(--color-warning)",
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium text-[var(--color-text-secondary)] w-10 text-right">
                        {member.completedPct}%
                      </span>
                    </div>
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
