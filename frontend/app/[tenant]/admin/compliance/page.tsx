"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTenant } from "@/components/providers/tenant-context";
import { TenantLogo } from "@/components/ui/tenant-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { NavToggles } from "@/components/ui/nav-toggles";
import { apiFetch } from "@/lib/api";
import { toast } from "@/lib/use-toast";
import { useI18n } from "@/lib/i18n/context";

type Assignment = {
  id: string;
  title: string;
  assigneeType: string;
  assigneeName: string;
  dueDate: string;
  status: string;
  completedAt?: string | null;
};

type ContentOption = { id: string; title: string };
type PathOption = { id: string; name: string };

export default function CompliancePage() {
  const params = useParams();
  const slug = typeof params.tenant === "string" ? params.tenant : "";
  const { t } = useI18n();
  const { tenant, branding, isLoading } = useTenant();

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [, setLoading] = useState(true);
  const [contentOptions, setContentOptions] = useState<ContentOption[]>([]);
  const [pathOptions, setPathOptions] = useState<PathOption[]>([]);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAssignment, setNewAssignment] = useState({
    type: "path" as "path" | "content",
    targetId: "",
    assigneeType: "all" as "all" | "group",
    assigneeId: "",
    dueDate: "",
  });

  const academyName = branding?.appName || tenant?.name || "Academy";

  useEffect(() => {
    if (!tenant) return;
    setLoading(true);
    Promise.all([
      apiFetch(`/company/tenants/${tenant.id}/compliance`).then((r) => r.json()).catch(() => []),
      apiFetch("/content").then((r) => r.json()).then((d) => Array.isArray(d) ? d : d?.items ?? []).catch(() => []),
      apiFetch("/learning-paths").then((r) => r.json()).catch(() => []),
    ]).then(([a, c, p]) => {
      setAssignments(Array.isArray(a) ? a : []);
      setContentOptions(c);
      setPathOptions(p);
    }).finally(() => setLoading(false));
  }, [tenant?.id]);

  const createAssignment = async () => {
    if (!tenant || !newAssignment.targetId || !newAssignment.dueDate) {
      toast("Please fill in all required fields", "error");
      return;
    }
    try {
      await apiFetch(`/company/tenants/${tenant.id}/compliance`, {
        method: "POST",
        body: JSON.stringify({
          tenantId: tenant.id,
          ...(newAssignment.type === "path" ? { pathId: newAssignment.targetId } : { contentId: newAssignment.targetId }),
          assigneeType: newAssignment.assigneeType === "all" ? "ALL" : "GROUP",
          assigneeId: newAssignment.assigneeType === "all" ? null : newAssignment.assigneeId,
          dueDate: newAssignment.dueDate,
        }),
      });
      toast("Training assignment created", "success");
      setShowCreateForm(false);
      setNewAssignment({ type: "path", targetId: "", assigneeType: "all", assigneeId: "", dueDate: "" });
    } catch {
      toast("Failed to create assignment", "error");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
        <div className="h-10 w-10 rounded-full border-4 border-[var(--color-accent)] border-t-transparent animate-spin" />
      </div>
    );
  }

  const overdue = assignments.filter((a) => a.status !== "COMPLETED" && new Date(a.dueDate) < new Date());
  const pending = assignments.filter((a) => a.status !== "COMPLETED" && new Date(a.dueDate) >= new Date());
  const completed = assignments.filter((a) => a.status === "COMPLETED");
  const complianceRate = assignments.length > 0
    ? Math.round((completed.length / assignments.length) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <header className="border-b border-[var(--color-bg-secondary)] px-6 py-4 flex justify-between items-center">
        <Link href={`/${slug}/admin`} className="flex items-center gap-3">
          <TenantLogo logoUrl={tenant?.logoUrl} name={academyName} size="md" />
          <span className="text-lg font-bold text-[var(--color-text-primary)]">{academyName}</span>
          <span className="text-sm text-[var(--color-text-secondary)]">/ {t("adminTenant.compliance")}</span>
        </Link>
        <NavToggles />
      </header>

      <main className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{t("adminTenant.complianceTraining")}</h1>
          <Button variant="primary" onClick={() => setShowCreateForm(!showCreateForm)}>
            {showCreateForm ? t("common.cancel") : t("adminTenant.assignTraining")}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatCard value={assignments.length} label={t("adminTenant.totalAssignments")} />
          <StatCard value={overdue.length} label={t("adminTenant.overdue")} alert={overdue.length > 0} />
          <StatCard value={pending.length} label={t("adminTenant.pending")} />
          <StatCard value={`${complianceRate}%`} label={t("adminTenant.complianceRate")} />
        </div>

        {showCreateForm && (
          <Card className="mb-6">
            <CardHeader><CardTitle>Create Training Assignment</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Type</label>
                  <select
                    value={newAssignment.type}
                    onChange={(e) => setNewAssignment((a) => ({ ...a, type: e.target.value as "path" | "content", targetId: "" }))}
                    className="w-full mt-1 rounded-lg border border-[var(--color-bg-secondary)] bg-white dark:bg-[#1a1e18] px-3 py-2 text-sm"
                  >
                    <option value="path">Learning Path</option>
                    <option value="content">Content Item</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">{newAssignment.type === "path" ? "Learning Path" : "Content"}</label>
                  <select
                    value={newAssignment.targetId}
                    onChange={(e) => setNewAssignment((a) => ({ ...a, targetId: e.target.value }))}
                    className="w-full mt-1 rounded-lg border border-[var(--color-bg-secondary)] bg-white dark:bg-[#1a1e18] px-3 py-2 text-sm"
                  >
                    <option value="">Select...</option>
                    {newAssignment.type === "path"
                      ? pathOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)
                      : contentOptions.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)
                    }
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Assign To</label>
                  <select
                    value={newAssignment.assigneeType}
                    onChange={(e) => setNewAssignment((a) => ({ ...a, assigneeType: e.target.value as "all" | "group" }))}
                    className="w-full mt-1 rounded-lg border border-[var(--color-bg-secondary)] bg-white dark:bg-[#1a1e18] px-3 py-2 text-sm"
                  >
                    <option value="all">All Users</option>
                    <option value="group">Specific Group</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Due Date</label>
                  <Input
                    type="date"
                    value={newAssignment.dueDate}
                    onChange={(e) => setNewAssignment((a) => ({ ...a, dueDate: e.target.value }))}
                  />
                </div>
              </div>
              <Button variant="primary" onClick={createAssignment}>Create Assignment</Button>
            </CardContent>
          </Card>
        )}

        {overdue.length > 0 && (
          <Card className="mb-6 border-[var(--color-error)]">
            <CardHeader><CardTitle className="text-[var(--color-error)]">Overdue ({overdue.length})</CardTitle></CardHeader>
            <CardContent>
              <AssignmentList items={overdue} t={t} />
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardHeader><CardTitle>Pending ({pending.length})</CardTitle></CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)]">{t("adminTenant.noPending")}</p>
            ) : (
              <AssignmentList items={pending} t={t} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Completed ({completed.length})</CardTitle></CardHeader>
          <CardContent>
            {completed.length === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)]">{t("adminTenant.noCompleted")}</p>
            ) : (
              <AssignmentList items={completed} t={t} />
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function StatCard({ value, label, alert }: { value: string | number; label: React.ReactNode; alert?: boolean }) {
  return (
    <div className={`card-brand p-4 text-center ${alert ? "border-[var(--color-error)]" : ""}`}>
      <div className={`text-2xl font-bold ${alert ? "text-[var(--color-error)]" : "text-[var(--color-text-primary)]"}`}>
        {value}
      </div>
      <div className="text-xs text-[var(--color-text-secondary)] mt-1">{label}</div>
    </div>
  );
}

function AssignmentList({ items, t }: { items: Assignment[]; t: (k: string) => string }) {
  return (
    <div className="divide-y divide-[var(--color-bg-secondary)]">
      {items.map((a) => (
        <div key={a.id} className="flex items-center justify-between py-3">
          <div>
            <p className="font-medium text-sm text-[var(--color-text-primary)]">{a.title}</p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {a.assigneeType === "ALL" ? t("adminTenant.allUsers") : a.assigneeName} &middot; {t("adminTenant.due")} {new Date(a.dueDate).toLocaleDateString()}
            </p>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
            a.status === "COMPLETED" ? "bg-[var(--color-success-light)] text-[var(--color-success)]" :
            new Date(a.dueDate) < new Date() ? "bg-[var(--color-error-light)] text-[var(--color-error)]" :
            "bg-[var(--color-warning-light)] text-[var(--color-warning)]"
          }`}>
            {a.status === "COMPLETED" ? t("adminTenant.completed") : new Date(a.dueDate) < new Date() ? t("adminTenant.overdue") : t("adminTenant.pending")}
          </span>
        </div>
      ))}
    </div>
  );
}
