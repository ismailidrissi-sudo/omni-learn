"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useUser } from "@/lib/use-user";
import { useAnalyticsFilters } from "@/components/analytics/analytics-filters-context";
import { toast } from "@/lib/use-toast";
import type { UserPlan } from "@/lib/use-user";

const PLANS: UserPlan[] = ["EXPLORER", "SPECIALIST", "VISIONARY", "NEXUS"];

type FullProfile = {
  user: {
    id: string;
    email: string;
    name: string;
    tenantId: string | null;
    planId: string;
    accountStatus?: string;
    orgApprovalStatus?: string | null;
    gender?: string | null;
    country?: string | null;
    city?: string | null;
    phoneNumber?: string | null;
    emailVerified?: boolean;
    profileComplete?: boolean;
    createdAt?: string;
  };
  company: {
    id: string;
    name: string;
    slug: string;
  } | null;
  activePaths: Array<{
    id: string;
    pathName?: string | null;
    progressPct: number;
    domainName?: string | null;
  }>;
  completedPaths: Array<{
    id: string;
    pathName?: string | null;
    progressPct: number;
    completedAt?: string | null;
  }>;
  activeCourses: Array<{
    id: string;
    courseName?: string | null;
    progressPct: number;
  }>;
  completedCourses: Array<{
    id: string;
    courseName?: string | null;
    progressPct: number;
    completedAt?: string | null;
  }>;
  gamification: { points: number };
};

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new Error("Invalid response from server.");
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    if (body && typeof body === "object" && body !== null && "message" in body) {
      const m = (body as { message: unknown }).message;
      if (Array.isArray(m)) msg = m.join(", ");
      else if (typeof m === "string") msg = m;
    }
    throw new Error(msg);
  }
  return body as T;
}

type PathOption = { id: string; name: string };

export function AdminUserProfileSheet({
  userId,
  onClose,
  onMutated,
}: {
  userId: string | null;
  onClose: () => void;
  onMutated?: () => void;
}) {
  const { user: actor } = useUser();
  const { tenants, courses } = useAnalyticsFilters();
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [planDraft, setPlanDraft] = useState<UserPlan>("EXPLORER");
  const [academyDraft, setAcademyDraft] = useState<string>("");
  const [courseToAdd, setCourseToAdd] = useState("");
  const [pathToAdd, setPathToAdd] = useState("");
  const [paths, setPaths] = useState<PathOption[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  const roles = actor?.roles ?? [];
  const canMutate = roles.includes("super_admin") || roles.includes("company_admin");
  const isSuperAdmin = roles.includes("super_admin") || !!actor?.isAdmin;

  const academyTenantOptions = useMemo(() => {
    if (isSuperAdmin) return tenants;
    const tid = actor?.tenantId;
    if (!tid) return [];
    const fromList = tenants.filter((t) => t.id === tid);
    if (fromList.length > 0) return fromList;
    return [{ id: tid, name: "Your academy" }];
  }, [tenants, isSuperAdmin, actor?.tenantId]);

  const loadProfile = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/analytics/deep/users/${userId}`);
      const data = await parseJson<FullProfile>(res);
      setProfile(data);
      setPlanDraft((data.user.planId as UserPlan) || "EXPLORER");
      setAcademyDraft(data.user.tenantId ?? "");
      setCourseToAdd("");
      setPathToAdd("");
    } catch (e) {
      setProfile(null);
      setError(e instanceof Error ? e.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    void loadProfile();
  }, [userId, loadProfile]);

  const tenantIdForPaths = profile?.user.tenantId ?? actor?.tenantId ?? "";

  useEffect(() => {
    if (!userId || !tenantIdForPaths) {
      setPaths([]);
      return;
    }
    apiFetch(`/learning-paths?tenantId=${encodeURIComponent(tenantIdForPaths)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: unknown) => {
        if (!Array.isArray(list)) {
          setPaths([]);
          return;
        }
        setPaths(
          list.map((p: { id?: string; name?: string }) => ({
            id: p.id ?? "",
            name: p.name ?? "Path",
          })).filter((p) => p.id),
        );
      })
      .catch(() => setPaths([]));
  }, [userId, tenantIdForPaths]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape" && userId) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [userId, onClose]);

  const notifyMutated = () => {
    onMutated?.();
    void loadProfile();
  };

  const savePlan = async () => {
    if (!userId || !canMutate) return;
    setSaving("plan");
    try {
      const res = await apiFetch(`/company/users/${userId}/plan`, {
        method: "PATCH",
        body: JSON.stringify({ planId: planDraft }),
      });
      await parseJson(res);
      toast("Plan updated", "success");
      notifyMutated();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to update plan", "error");
    } finally {
      setSaving(null);
    }
  };

  const saveAcademy = async () => {
    if (!userId || !canMutate) return;
    setSaving("academy");
    try {
      const tenantId = academyDraft === "" ? null : academyDraft;
      const res = await apiFetch(`/company/users/${userId}/academy`, {
        method: "PATCH",
        body: JSON.stringify({ tenantId }),
      });
      await parseJson(res);
      toast("Academy updated", "success");
      notifyMutated();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to update academy", "error");
    } finally {
      setSaving(null);
    }
  };

  const setSuspended = async (suspended: boolean) => {
    if (!userId || !canMutate) return;
    setSaving("status");
    try {
      const res = await apiFetch(`/company/users/${userId}/account-status`, {
        method: "PATCH",
        body: JSON.stringify({ accountStatus: suspended ? "SUSPENDED" : "ACTIVE" }),
      });
      await parseJson(res);
      toast(suspended ? "User blocked" : "Access restored", "success");
      notifyMutated();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to update status", "error");
    } finally {
      setSaving(null);
    }
  };

  const addCourse = async () => {
    if (!userId || !canMutate || !courseToAdd) return;
    setSaving("course");
    try {
      const res = await apiFetch(`/company/users/${userId}/enrollments/course`, {
        method: "POST",
        body: JSON.stringify({ courseId: courseToAdd }),
      });
      await parseJson(res);
      toast("Course enrollment added", "success");
      setCourseToAdd("");
      notifyMutated();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Enrollment failed", "error");
    } finally {
      setSaving(null);
    }
  };

  const addPath = async () => {
    if (!userId || !canMutate || !pathToAdd) return;
    setSaving("path");
    try {
      const res = await apiFetch(`/company/users/${userId}/enrollments/path`, {
        method: "POST",
        body: JSON.stringify({ pathId: pathToAdd }),
      });
      await parseJson(res);
      toast("Learning path enrollment added", "success");
      setPathToAdd("");
      notifyMutated();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Enrollment failed", "error");
    } finally {
      setSaving(null);
    }
  };

  if (!userId) return null;

  const suspended = profile?.user.accountStatus === "SUSPENDED";

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="admin-user-profile-title">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        aria-label="Close panel"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg h-full bg-[var(--color-bg-primary)] border-l border-[var(--color-bg-secondary)] shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-bg-secondary)] shrink-0">
          <h2 id="admin-user-profile-title" className="text-lg font-semibold text-[var(--color-text-primary)]">
            User profile
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-brand-purple/10 text-[var(--color-text-muted)]"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {loading && <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>}
          {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}

          {!loading && profile && (
            <>
              <section className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Identity</p>
                <p className="text-base font-medium text-[var(--color-text-primary)]">{profile.user.name}</p>
                <p className="text-sm text-[var(--color-text-secondary)]">{profile.user.email}</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Status:{" "}
                  <span className={suspended ? "text-[var(--color-error)] font-medium" : "text-emerald-700 font-medium"}>
                    {profile.user.accountStatus ?? "ACTIVE"}
                  </span>
                  {profile.user.orgApprovalStatus != null && (
                    <> · Org: {String(profile.user.orgApprovalStatus)}</>
                  )}
                </p>
              </section>

              <section className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Affiliation (academy)</p>
                <p className="text-sm text-[var(--color-text-primary)]">
                  {profile.company?.name ?? "—"}{" "}
                  {profile.company?.slug && (
                    <span className="text-[var(--color-text-muted)]">({profile.company.slug})</span>
                  )}
                </p>
              </section>

              <section className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Profile</p>
                <ul className="text-sm text-[var(--color-text-secondary)] space-y-1">
                  <li>Country: {profile.user.country ?? "—"}</li>
                  <li>City: {profile.user.city ?? "—"}</li>
                  <li>Gender: {profile.user.gender ?? "—"}</li>
                  <li>Phone: {profile.user.phoneNumber ?? "—"}</li>
                  <li>
                    Email verified: {profile.user.emailVerified ? "Yes" : "No"} · Profile complete:{" "}
                    {profile.user.profileComplete ? "Yes" : "No"}
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Plan</p>
                <p className="text-sm text-[var(--color-text-primary)]">Current: {profile.user.planId}</p>
              </section>

              <section className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Paths</p>
                <ul className="text-sm space-y-1 max-h-32 overflow-y-auto">
                  {profile.activePaths.map((p) => (
                    <li key={p.id} className="text-[var(--color-text-secondary)]">
                      {p.pathName ?? p.id} — {p.progressPct}%
                    </li>
                  ))}
                  {profile.activePaths.length === 0 && <li className="text-[var(--color-text-muted)]">No active paths</li>}
                </ul>
                <p className="text-xs font-medium text-[var(--color-text-muted)]">Completed</p>
                <ul className="text-sm space-y-1 max-h-24 overflow-y-auto">
                  {profile.completedPaths.map((p) => (
                    <li key={p.id} className="text-[var(--color-text-secondary)]">
                      {p.pathName ?? p.id} — {p.progressPct}%
                    </li>
                  ))}
                  {profile.completedPaths.length === 0 && <li className="text-[var(--color-text-muted)]">—</li>}
                </ul>
              </section>

              <section className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Courses</p>
                <ul className="text-sm space-y-1 max-h-32 overflow-y-auto">
                  {profile.activeCourses.map((c) => (
                    <li key={c.id} className="text-[var(--color-text-secondary)]">
                      {c.courseName ?? c.id} — {c.progressPct}%
                    </li>
                  ))}
                  {profile.activeCourses.length === 0 && <li className="text-[var(--color-text-muted)]">No active courses</li>}
                </ul>
                <p className="text-xs font-medium text-[var(--color-text-muted)]">Completed</p>
                <ul className="text-sm space-y-1 max-h-24 overflow-y-auto">
                  {profile.completedCourses.map((c) => (
                    <li key={c.id} className="text-[var(--color-text-secondary)]">
                      {c.courseName ?? c.id} — {c.progressPct}%
                    </li>
                  ))}
                  {profile.completedCourses.length === 0 && <li className="text-[var(--color-text-muted)]">—</li>}
                </ul>
              </section>

              <section>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Gamification</p>
                <p className="text-sm text-[var(--color-text-primary)]">Points: {profile.gamification.points}</p>
              </section>

              {canMutate && (
                <section className="space-y-4 pt-2 border-t border-[var(--color-bg-secondary)]">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Admin actions</p>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!!saving || suspended}
                      onClick={() => void setSuspended(true)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--color-error-light)] text-[var(--color-error)] border border-[var(--color-error-border)] disabled:opacity-40"
                    >
                      Block user
                    </button>
                    <button
                      type="button"
                      disabled={!!saving || !suspended}
                      onClick={() => void setSuspended(false)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--color-bg-secondary)] hover:bg-brand-purple/10 disabled:opacity-40"
                    >
                      Restore access
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-[var(--color-text-muted)]">Change plan</label>
                    <div className="flex gap-2 flex-wrap">
                      <select
                        value={planDraft}
                        onChange={(e) => setPlanDraft(e.target.value as UserPlan)}
                        className="flex-1 min-w-[140px] text-sm border border-[var(--color-bg-secondary)] rounded-lg px-2 py-1.5 bg-[var(--color-bg-primary)]"
                      >
                        {PLANS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={saving === "plan" || planDraft === profile.user.planId}
                        onClick={() => void savePlan()}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-purple text-white disabled:opacity-40"
                      >
                        {saving === "plan" ? "…" : "Save plan"}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-[var(--color-text-muted)]">Academy (tenant)</label>
                    <div className="flex gap-2 flex-wrap">
                      <select
                        value={academyDraft}
                        onChange={(e) => setAcademyDraft(e.target.value)}
                        className="flex-1 min-w-[160px] text-sm border border-[var(--color-bg-secondary)] rounded-lg px-2 py-1.5 bg-[var(--color-bg-primary)]"
                      >
                        {isSuperAdmin && <option value="">None (remove)</option>}
                        {!isSuperAdmin && <option value="">Select academy…</option>}
                        {academyTenantOptions.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={
                          saving === "academy" ||
                          (academyDraft || "") === (profile.user.tenantId ?? "") ||
                          (!isSuperAdmin && academyDraft === "")
                        }
                        onClick={() => void saveAcademy()}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-purple text-white disabled:opacity-40"
                      >
                        {saving === "academy" ? "…" : "Save academy"}
                      </button>
                    </div>
                    {!isSuperAdmin && (
                      <p className="text-[10px] text-[var(--color-text-muted)]">
                        Company admins can assign users to their own academy only. Removing a user from an academy requires a platform admin.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-[var(--color-text-muted)]">Add course access</label>
                    <div className="flex gap-2 flex-wrap">
                      <select
                        value={courseToAdd}
                        onChange={(e) => setCourseToAdd(e.target.value)}
                        className="flex-1 min-w-[160px] text-sm border border-[var(--color-bg-secondary)] rounded-lg px-2 py-1.5 bg-[var(--color-bg-primary)]"
                      >
                        <option value="">Select course…</option>
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={saving === "course" || !courseToAdd}
                        onClick={() => void addCourse()}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-purple text-white disabled:opacity-40"
                      >
                        {saving === "course" ? "…" : "Enroll"}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-[var(--color-text-muted)]">Add learning path</label>
                    <div className="flex gap-2 flex-wrap">
                      <select
                        value={pathToAdd}
                        onChange={(e) => setPathToAdd(e.target.value)}
                        className="flex-1 min-w-[160px] text-sm border border-[var(--color-bg-secondary)] rounded-lg px-2 py-1.5 bg-[var(--color-bg-primary)]"
                      >
                        <option value="">{tenantIdForPaths ? "Select path…" : "Set user tenant to load paths"}</option>
                        {paths.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={saving === "path" || !pathToAdd}
                        onClick={() => void addPath()}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-purple text-white disabled:opacity-40"
                      >
                        {saving === "path" ? "…" : "Enroll"}
                      </button>
                    </div>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
