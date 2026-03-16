"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTenant } from "@/components/providers/tenant-context";
import { TenantLogo } from "@/components/ui/tenant-logo";
import { Button } from "@/components/ui/button";
import { PathProgress } from "@/components/learning/path-progress";
import { PointsBadgesStreaks } from "@/components/gamification/points-badges-streaks";
import { useI18n } from "@/lib/i18n/context";
import { useUser } from "@/lib/use-user";
import { NavToggles } from "@/components/ui/nav-toggles";
import { apiFetch } from "@/lib/api";
import { track } from "@/lib/analytics";

type Path = {
  id: string;
  name: string;
  domain?: { id: string; name: string; slug: string } | string;
  steps?: { id: string; stepOrder: number; contentItem: { id: string; title: string; type: string }; isRequired?: boolean }[];
};
type Enrollment = { id: string; progressPct: number; stepProgress: { stepId: string; status: string }[] };

export default function TenantLearnPage() {
  const params = useParams();
  const slug = typeof params.tenant === "string" ? params.tenant : "";
  const router = useRouter();
  const { t } = useI18n();
  const { tenant, branding, isLoading: tenantLoading } = useTenant();
  const { user, loading: userLoading } = useUser();

  const [paths, setPaths] = useState<Path[]>([]);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [pathDetail, setPathDetail] = useState<Path | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [points, setPoints] = useState(0);
  const [badges, setBadges] = useState<{ id: string; name: string; icon: string; earnedAt: string }[]>([]);
  const [streak, setStreak] = useState({ currentStreak: 0, longestStreak: 0 });
  const [loading, setLoading] = useState(true);

  const userId = user?.id;
  const academyName = branding?.appName || tenant?.name || "Academy";
  const primaryColor = branding?.primaryColor || "#059669";

  useEffect(() => {
    if (!userLoading && !user) {
      router.replace(`/${slug}/signin?redirect=/${slug}/learn`);
    }
  }, [userLoading, user, router, slug]);

  useEffect(() => {
    if (!userId) return;
    apiFetch("/learning-paths")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setPaths(list);
        if (list.length > 0) setSelectedPathId(list[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    apiFetch(`/gamification/points/${userId}`).then((r) => r.json()).then((d) => setPoints(d?.points ?? 0)).catch(() => {});
    apiFetch(`/gamification/badges/${userId}`).then((r) => r.json()).then((d) => setBadges(Array.isArray(d) ? d : [])).catch(() => {});
    apiFetch(`/gamification/streak/${userId}`).then((r) => r.json()).then(setStreak).catch(() => {});

    track("page_view", { page: "tenant_learn", tenant: slug });
  }, [userId, slug]);

  useEffect(() => {
    if (!selectedPathId || !userId) return;
    apiFetch(`/learning-paths/${selectedPathId}`)
      .then((r) => r.json())
      .then(setPathDetail)
      .catch(() => {});
    apiFetch(`/learning-paths/${selectedPathId}/enrollment/${userId}`)
      .then((r) => r.json())
      .then(setEnrollment)
      .catch(() => setEnrollment(null));
  }, [selectedPathId, userId]);

  const enroll = async () => {
    if (!selectedPathId || !userId) return;
    await apiFetch(`/learning-paths/${selectedPathId}/enroll`, { method: "POST", body: JSON.stringify({ userId }) });
    const e = await apiFetch(`/learning-paths/${selectedPathId}/enrollment/${userId}`).then((r) => r.json());
    setEnrollment(e);
  };

  const completeStep = async (stepId: string) => {
    if (!enrollment) return;
    await apiFetch(`/learning-paths/enrollments/${enrollment.id}/steps/${stepId}/progress`, {
      method: "POST",
      body: JSON.stringify({ status: "COMPLETED" }),
    });
    const e = await apiFetch(`/learning-paths/${selectedPathId}/enrollment/${userId}`).then((r) => r.json());
    setEnrollment(e);
  };

  if (tenantLoading || userLoading) {
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
          <Link href={`/${slug}/learn`}><Button variant="primary" size="sm">{t("tenant.learn")}</Button></Link>
          <Link href={`/${slug}/discover`}><Button variant="ghost" size="sm">{t("tenant.discover")}</Button></Link>
          <Link href={`/${slug}/forum`}><Button variant="ghost" size="sm">{t("tenant.forum")}</Button></Link>
          {(user?.isAdmin || user?.planId === "NEXUS" || user?.trainerApprovedAt) && (
            <Link href={`/${slug}/admin`}><Button variant="ghost" size="sm">{t("tenant.admin")}</Button></Link>
          )}
          <div className="pl-3 ml-3 border-l border-[var(--color-bg-secondary)]">
            <NavToggles />
          </div>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        <div className="flex flex-col md:flex-row gap-6">
          <aside className="md:w-64 shrink-0">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-3">
              {t("tenant.learningPaths")}
            </h2>
            <div className="space-y-1">
              {paths.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPathId(p.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    selectedPathId === p.id
                      ? "text-white font-medium"
                      : "text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]"
                  }`}
                  style={selectedPathId === p.id ? { backgroundColor: primaryColor } : undefined}
                >
                  {p.name}
                </button>
              ))}
              {paths.length === 0 && !loading && (
                <p className="text-sm text-[var(--color-text-secondary)] px-3">{t("tenant.noPathsYet")}</p>
              )}
            </div>
          </aside>

          <div className="flex-1 space-y-6">
            <PointsBadgesStreaks points={points} badges={badges} currentStreak={streak.currentStreak} longestStreak={streak.longestStreak} />

            {pathDetail && (
              <div className="card-brand p-6">
                <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-1">{pathDetail.name}</h2>
                <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                  {pathDetail.steps?.length ?? 0} steps
                </p>

                {!enrollment ? (
                  <Button variant="primary" onClick={enroll}>{t("tenant.enrollInPath")}</Button>
                ) : (
                  <PathProgress
                    pathName={pathDetail.name}
                    steps={pathDetail.steps?.map((s) => {
                      const status = enrollment.stepProgress?.find((sp) => sp.stepId === s.id)?.status ?? "NOT_STARTED";
                      return {
                        id: s.id,
                        title: s.contentItem.title,
                        type: s.contentItem.type,
                        isRequired: s.isRequired ?? true,
                        status: status as "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED",
                      };
                    }) ?? []}
                    progressPct={enrollment.progressPct}
                    onStepClick={(stepId) => completeStep(stepId)}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
