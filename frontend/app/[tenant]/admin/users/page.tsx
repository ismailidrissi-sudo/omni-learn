"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useParams } from "next/navigation";
import { useTenant } from "@/components/providers/tenant-context";
import { TenantAdminBurgerHeader } from "@/components/ui/tenant-admin-burger-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { AdminUserProfileSheet } from "@/components/admin/admin-user-profile-sheet";
import { apiFetch } from "@/lib/api";
import { toast } from "@/lib/use-toast";
import { useI18n } from "@/lib/i18n/context";
import { bulkInviteFeedback } from "@/lib/bulk-invite-feedback";
import { ExportButtons } from "@/components/ui/export-buttons";
import type { ColumnDef } from "@/lib/exports/list-export";

type User = {
  id: string;
  name: string;
  email: string;
  tenantId?: string;
  planId?: string;
  accountStatus?: string;
  orgApprovalStatus?: string;
  trainerApprovedAt?: string | null;
  trainerRequested?: boolean;
  createdAt?: string;
};

type CourseOption = { id: string; title: string };
type PathOption = { id: string; name: string };

type RoleFilter = "all" | "learner" | "instructor";
type StatusFilter = "all" | "active" | "suspended" | "pending";

export default function UserManagementPage() {
  const params = useParams();
  const slug = typeof params.tenant === "string" ? params.tenant : "";
  const { t } = useI18n();
  const { tenant, branding, isLoading } = useTenant();

  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmails, setInviteEmails] = useState("");
  const [inviting, setInviting] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const [courseOptions, setCourseOptions] = useState<CourseOption[]>([]);
  const [pathOptions, setPathOptions] = useState<PathOption[]>([]);
  const [bulkCourseId, setBulkCourseId] = useState("");
  const [bulkPathId, setBulkPathId] = useState("");
  const [bulkBusy, setBulkBusy] = useState<"course" | "path" | null>(null);

  const academyName = branding?.appName || tenant?.name || "Academy";

  const fetchUsers = () => {
    if (!tenant) return;
    setLoading(true);
    apiFetch(`/company/users?tenantId=${tenant.id}`)
      .then((r) => r.json())
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setError(t("adminTenant.failedToLoadUsers")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (tenant) fetchUsers();
  }, [tenant?.id]);

  useEffect(() => {
    if (!tenant) return;
    apiFetch("/content?type=COURSE&limit=200")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: unknown) => {
        if (!Array.isArray(list)) return setCourseOptions([]);
        setCourseOptions(
          list
            .map((c: { id?: string; title?: string }) => ({
              id: c.id ?? "",
              title: c.title ?? "Course",
            }))
            .filter((c) => c.id),
        );
      })
      .catch(() => setCourseOptions([]));
  }, [tenant?.id]);

  useEffect(() => {
    if (!tenant) return;
    apiFetch(`/learning-paths?tenantId=${encodeURIComponent(tenant.id)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: unknown) => {
        if (!Array.isArray(list)) return setPathOptions([]);
        setPathOptions(
          list
            .map((p: { id?: string; name?: string }) => ({
              id: p.id ?? "",
              name: p.name ?? "Path",
            }))
            .filter((p) => p.id),
        );
      })
      .catch(() => setPathOptions([]));
  }, [tenant?.id]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter((u) => {
      const matchesSearch =
        !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      if (!matchesSearch) return false;

      const isInstructor = !!u.trainerApprovedAt;
      if (roleFilter === "learner" && isInstructor) return false;
      if (roleFilter === "instructor" && !isInstructor) return false;

      const status = u.accountStatus ?? "ACTIVE";
      const orgStatus = u.orgApprovalStatus ?? "APPROVED";
      if (statusFilter === "active" && status !== "ACTIVE") return false;
      if (statusFilter === "suspended" && status !== "SUSPENDED") return false;
      if (statusFilter === "pending" && orgStatus !== "PENDING") return false;
      return true;
    });
  }, [users, search, roleFilter, statusFilter]);

  const allSelected = filtered.length > 0 && filtered.every((u) => selectedIds.has(u.id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleSelectAllVisible = () => {
    if (allSelected) {
      const next = new Set(selectedIds);
      filtered.forEach((u) => next.delete(u.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      filtered.forEach((u) => next.add(u.id));
      setSelectedIds(next);
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const clearSelection = () => setSelectedIds(new Set());

  const parseInviteEmails = (raw: string) =>
    [...new Set(raw.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@")))];

  const handleBulkInvite = async () => {
    if (!tenant) return;
    const emails = parseInviteEmails(inviteEmails);
    if (emails.length === 0) {
      toast(t("adminTenant.inviteResultNoValidEmails"), "error");
      return;
    }
    setInviting(true);
    setError("");
    try {
      const res = await apiFetch("/company/users/bulk-invite", {
        method: "POST",
        body: JSON.stringify({ tenantId: tenant.id, emails }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message ?? "Invite failed");
      }
      const fb = bulkInviteFeedback(t, data);
      toast(fb.message, fb.type);
      setInviteEmails("");
      setInviteOpen(false);
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setInviting(false);
    }
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenant) return;
    setImporting(true);
    setError("");

    try {
      const text = await file.text();
      const lines = text.split("\n").filter((l) => l.trim());
      const header = lines[0].toLowerCase();
      const hasHeader = header.includes("email") || header.includes("name");
      const dataLines = hasHeader ? lines.slice(1) : lines;

      const importUsers = dataLines.map((line) => {
        const parts = line.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
        return { name: parts[0] || "", email: parts[1] || "", role: parts[2] || "LEARNER_BASIC" };
      }).filter((u) => u.email.includes("@"));

      const res = await apiFetch(`/company/users/bulk-import`, {
        method: "POST",
        body: JSON.stringify({ tenantId: tenant.id, users: importUsers }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? "Import failed");
      }
      const result = await res.json();
      toast(t("adminTenant.importedSuccess", { count: String(result.created ?? importUsers.length) }), "success");
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("adminTenant.importFailed"));
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const bulkEnrollCourse = async () => {
    if (!bulkCourseId || selectedIds.size === 0) return;
    setBulkBusy("course");
    try {
      const res = await apiFetch("/company/users/enrollments/bulk-course", {
        method: "POST",
        body: JSON.stringify({
          courseId: bulkCourseId,
          userIds: Array.from(selectedIds),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? "Bulk enroll failed");
      toast(
        t("adminTenant.bulkEnrolledCourse", {
          enrolled: String(data.enrolled ?? 0),
          skipped: String(data.skipped ?? 0),
        }) ||
          `Enrolled ${data.enrolled ?? 0} learner(s); ${data.skipped ?? 0} already enrolled.`,
        "success",
      );
      clearSelection();
      setBulkCourseId("");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Bulk enroll failed", "error");
    } finally {
      setBulkBusy(null);
    }
  };

  const bulkEnrollPath = async () => {
    if (!bulkPathId || selectedIds.size === 0) return;
    setBulkBusy("path");
    try {
      const res = await apiFetch("/company/users/enrollments/bulk-path", {
        method: "POST",
        body: JSON.stringify({
          pathId: bulkPathId,
          userIds: Array.from(selectedIds),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? "Bulk enroll failed");
      toast(
        t("adminTenant.bulkEnrolledPath", {
          enrolled: String(data.enrolled ?? 0),
          skipped: String(data.skipped ?? 0),
        }) ||
          `Enrolled ${data.enrolled ?? 0} learner(s); ${data.skipped ?? 0} already enrolled.`,
        "success",
      );
      clearSelection();
      setBulkPathId("");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Bulk enroll failed", "error");
    } finally {
      setBulkBusy(null);
    }
  };

  const toggleInstructor = async (userId: string) => {
    try {
      const res = await apiFetch(`/company/users/${userId}/toggle-instructor`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? "Toggle failed");
      toast(data.message ?? "Role updated", "success");
      fetchUsers();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Toggle failed", "error");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
        <div className="h-10 w-10 rounded-full border-4 border-[var(--color-accent)] border-t-transparent animate-spin" />
      </div>
    );
  }

  const renderRoleBadge = (u: User) => {
    if (u.trainerApprovedAt) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-brand-purple/15 text-brand-purple">
          {t("adminTenant.roleInstructor") || "Instructor"}
        </span>
      );
    }
    if (u.trainerRequested) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
          {t("adminTenant.roleTrainerRequested") || "Trainer pending"}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]">
        {t("adminTenant.roleLearner") || "Learner"}
      </span>
    );
  };

  const userRoleLabel = (u: User) => {
    if (u.trainerApprovedAt) return t("adminTenant.roleInstructor");
    if (u.trainerRequested) return t("adminTenant.roleTrainerRequested");
    return t("adminTenant.roleLearner");
  };

  const userStatusLabel = (u: User) => {
    const status = u.accountStatus ?? "ACTIVE";
    const org = u.orgApprovalStatus ?? "APPROVED";
    if (status === "SUSPENDED") return t("adminTenant.statusSuspended");
    if (org === "PENDING") return t("adminTenant.statusPending");
    return t("adminTenant.statusActive");
  };

  const userExportColumns: ColumnDef<User>[] = [
    { key: "name", header: t("adminTenant.name"), accessor: (u) => u.name },
    { key: "email", header: "Email", accessor: (u) => u.email },
    { key: "role", header: t("adminTenant.role"), accessor: userRoleLabel },
    { key: "status", header: t("adminTenant.status"), accessor: userStatusLabel },
    {
      key: "joined",
      header: "Joined",
      accessor: (u) => (u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"),
    },
  ];

  const renderStatusBadge = (u: User) => {
    const status = u.accountStatus ?? "ACTIVE";
    const org = u.orgApprovalStatus ?? "APPROVED";
    if (status === "SUSPENDED") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-error-light)] text-[var(--color-error)]">
          {t("adminTenant.statusSuspended") || "Blocked"}
        </span>
      );
    }
    if (org === "PENDING") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
          {t("adminTenant.statusPending") || "Pending"}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
        {t("adminTenant.statusActive") || "Active"}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <TenantAdminBurgerHeader
        slug={slug}
        academyName={academyName}
        logoUrl={tenant?.logoUrl}
        contextSlot={<span className="text-sm text-[var(--color-text-secondary)]">/ {t("adminTenant.users")}</span>}
      />

      <main className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">User Management</h1>
            <p className="text-sm text-[var(--color-text-secondary)]">{users.length} users in {academyName}</p>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <ExportButtons<User>
              rows={filtered}
              columns={userExportColumns}
              tenantSlug={slug}
              filenameBase="users"
              pdfTitle={`${t("adminTenant.userManagement")} — ${academyName}`}
              academyLogoUrl={tenant?.logoUrl}
            />
            <Button variant="primary" type="button" onClick={() => setInviteOpen(true)}>
              {t("adminTenant.inviteUsers") || "Invite by email"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleCsvImport}
              className="hidden"
            />
            <Button variant="ghost" onClick={() => fileRef.current?.click()} disabled={importing}>
              {importing ? t("common.loading") : t("adminTenant.importCsv")}
            </Button>
          </div>
        </div>

        {error && <ErrorBanner message={error} onDismiss={() => setError("")} className="mb-6" />}

        {inviteOpen && (
          <div className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/40 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {t("adminTenant.inviteUsersTitle") || "Invite learners (magic link)"}
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {t("adminTenant.inviteUsersHint") ||
                "One email per line, or comma-separated. New accounts receive a sign-in link; existing emails are skipped."}
            </p>
            <textarea
              className="w-full min-h-[120px] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
              value={inviteEmails}
              onChange={(e) => setInviteEmails(e.target.value)}
              placeholder="name@company.com"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" type="button" onClick={() => setInviteOpen(false)} disabled={inviting}>
                {t("common.cancel") || "Cancel"}
              </Button>
              <Button variant="primary" type="button" onClick={handleBulkInvite} disabled={inviting}>
                {inviting ? t("common.loading") : t("adminTenant.sendInvites") || "Send invites"}
              </Button>
            </div>
          </div>
        )}

        {selectedIds.size > 0 && (
          <div className="mb-4 rounded-xl border border-brand-purple/30 bg-brand-purple/5 p-4 flex flex-wrap items-center gap-3">
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              {t("adminTenant.selectedCount", { count: String(selectedIds.size) }) ||
                `${selectedIds.size} selected`}
            </p>

            <div className="flex flex-wrap items-center gap-2 ml-auto">
              <select
                value={bulkCourseId}
                onChange={(e) => setBulkCourseId(e.target.value)}
                className="text-sm border border-[var(--color-bg-secondary)] rounded-lg px-2 py-1.5 bg-[var(--color-bg-primary)] min-w-[160px]"
              >
                <option value="">{t("adminTenant.selectCourse") || "Select a course…"}</option>
                {courseOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
              <Button
                type="button"
                variant="primary"
                onClick={bulkEnrollCourse}
                disabled={!bulkCourseId || bulkBusy !== null}
              >
                {bulkBusy === "course"
                  ? t("common.loading")
                  : t("adminTenant.enrollInCourse") || "Enroll in course"}
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={bulkPathId}
                onChange={(e) => setBulkPathId(e.target.value)}
                className="text-sm border border-[var(--color-bg-secondary)] rounded-lg px-2 py-1.5 bg-[var(--color-bg-primary)] min-w-[160px]"
              >
                <option value="">
                  {pathOptions.length === 0
                    ? t("adminTenant.noPathsAvailable") || "No learning paths"
                    : t("adminTenant.selectPath") || "Select a path…"}
                </option>
                {pathOptions.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <Button
                type="button"
                variant="primary"
                onClick={bulkEnrollPath}
                disabled={!bulkPathId || bulkBusy !== null}
              >
                {bulkBusy === "path"
                  ? t("common.loading")
                  : t("adminTenant.enrollInPath") || "Enroll in path"}
              </Button>
              <Button type="button" variant="ghost" onClick={clearSelection} disabled={bulkBusy !== null}>
                {t("common.cancel") || "Clear"}
              </Button>
            </div>
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3 flex-wrap">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("adminTenant.searchByNameEmail")}
                className="max-w-sm"
              />
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-[var(--color-text-muted)]">
                  {t("adminTenant.role") || "Role"}
                </label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
                  className="text-sm border border-[var(--color-bg-secondary)] rounded-lg px-2 py-1.5 bg-[var(--color-bg-primary)]"
                >
                  <option value="all">{t("adminTenant.filterAll") || "All"}</option>
                  <option value="learner">{t("adminTenant.roleLearner") || "Learner"}</option>
                  <option value="instructor">{t("adminTenant.roleInstructor") || "Instructor"}</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-[var(--color-text-muted)]">
                  {t("adminTenant.status") || "Status"}
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="text-sm border border-[var(--color-bg-secondary)] rounded-lg px-2 py-1.5 bg-[var(--color-bg-primary)]"
                >
                  <option value="all">{t("adminTenant.filterAll") || "All"}</option>
                  <option value="active">{t("adminTenant.statusActive") || "Active"}</option>
                  <option value="suspended">{t("adminTenant.statusSuspended") || "Blocked"}</option>
                  <option value="pending">{t("adminTenant.statusPending") || "Pending"}</option>
                </select>
              </div>
              <span className="text-sm text-[var(--color-text-secondary)] ml-auto">
                {filtered.length} {t("adminTenant.of")} {users.length}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="skeleton h-12 rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-bg-secondary)]">
                <div className="grid grid-cols-12 gap-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  <div className="col-span-1 flex items-center">
                    <input
                      type="checkbox"
                      aria-label="Select all visible"
                      checked={allSelected}
                      ref={(el) => { if (el) el.indeterminate = someSelected; }}
                      onChange={toggleSelectAllVisible}
                      className="h-4 w-4"
                    />
                  </div>
                  <div className="col-span-3">{t("adminTenant.name") || "Name"}</div>
                  <div className="col-span-3">Email</div>
                  <div className="col-span-2">{t("adminTenant.role") || "Role"}</div>
                  <div className="col-span-2">{t("adminTenant.status") || "Status"}</div>
                  <div className="col-span-1 text-right">{t("adminTenant.actions") || "Actions"}</div>
                </div>
                {filtered.map((user) => (
                  <div key={user.id} className="grid grid-cols-12 gap-3 py-3 items-center text-sm">
                    <div className="col-span-1">
                      <input
                        type="checkbox"
                        aria-label={`Select ${user.name}`}
                        checked={selectedIds.has(user.id)}
                        onChange={() => toggleSelect(user.id)}
                        className="h-4 w-4"
                      />
                    </div>
                    <div className="col-span-3 font-medium text-[var(--color-text-primary)] truncate">{user.name}</div>
                    <div className="col-span-3 text-[var(--color-text-secondary)] truncate">{user.email}</div>
                    <div className="col-span-2">{renderRoleBadge(user)}</div>
                    <div className="col-span-2">{renderStatusBadge(user)}</div>
                    <div className="col-span-1 flex justify-end gap-3">
                      <button
                        type="button"
                        className="text-xs text-[var(--color-text-secondary)] hover:underline"
                        onClick={() => toggleInstructor(user.id)}
                        title={
                          user.trainerApprovedAt
                            ? t("adminTenant.demoteToLearner") || "Demote to Learner"
                            : t("adminTenant.promoteToInstructor") || "Promote to Instructor"
                        }
                      >
                        {user.trainerApprovedAt
                          ? t("adminTenant.demote") || "Demote"
                          : t("adminTenant.promote") || "Promote"}
                      </button>
                      <button
                        type="button"
                        className="text-xs text-[var(--color-accent)] hover:underline"
                        onClick={() => setEditingUserId(user.id)}
                      >
                        {t("adminTenant.edit")}
                      </button>
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <div className="py-8 text-center text-[var(--color-text-secondary)]">
                    {search || roleFilter !== "all" || statusFilter !== "all"
                      ? t("adminTenant.noUsersMatch")
                      : t("adminTenant.noUsersFound")}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 p-4 rounded-lg bg-[var(--color-bg-secondary)]/50">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">{t("adminTenant.csvFormat")}</h3>
          <p className="text-xs text-[var(--color-text-secondary)] font-mono">
            name, email, role<br />
            Jane Smith, jane@company.com, LEARNER_BASIC<br />
            John Doe, john@company.com, COMPANY_MANAGER
          </p>
        </div>
      </main>

      {editingUserId && (
        <AdminUserProfileSheet
          userId={editingUserId}
          onClose={() => setEditingUserId(null)}
          onMutated={fetchUsers}
        />
      )}
    </div>
  );
}
