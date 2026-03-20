"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTenant } from "@/components/providers/tenant-context";
import { TenantLogo } from "@/components/ui/tenant-logo";
import { Button } from "@/components/ui/button";
import { CompletionCelebration } from "@/components/learning/completion-celebration";
import { PointsBadgesStreaks } from "@/components/gamification/points-badges-streaks";
import { ContentCard } from "@/components/learning/content-card";
import { ContentSection } from "@/components/learning/content-section";
import { PathCard } from "@/components/learning/path-card";
import { useI18n } from "@/lib/i18n/context";
import { useUser } from "@/lib/use-user";
import { AppBurgerHeader } from "@/components/ui/app-burger-header";
import { tenantLearnerNavItems } from "@/lib/nav/burger-nav";
import { apiFetch } from "@/lib/api";
import { track } from "@/lib/analytics";

type ContentItem = {
  id: string;
  title: string;
  type: string;
  description?: string | null;
  durationMinutes?: number | null;
};

type Path = {
  id: string;
  name: string;
  description?: string | null;
  difficulty?: string | null;
  domain?: { id: string; name: string; slug: string } | string;
  steps?: { id: string; stepOrder: number; contentItem: { id: string; title: string; type: string }; isRequired?: boolean }[];
};

type Enrollment = {
  id: string;
  pathId: string;
  progressPct: number;
  stepProgress: { stepId: string; status: string }[];
};

type CourseEnrollment = {
  id: string;
  courseId: string;
  progressPct: number;
};

const CONTENT_CATEGORIES = [
  { type: "COURSE", icon: "📚", labelKey: "learn.courses" },
  { type: "MICRO_LEARNING", icon: "⚡", labelKey: "learn.microlearnings" },
  { type: "PODCAST", icon: "🎧", labelKey: "learn.podcasts" },
  { type: "VIDEO", icon: "🎬", labelKey: "learn.videos" },
  { type: "DOCUMENT", icon: "📄", labelKey: "learn.documents" },
  { type: "IMPLEMENTATION_GUIDE", icon: "🛠️", labelKey: "learn.guides" },
  { type: "QUIZ_ASSESSMENT", icon: "✅", labelKey: "learn.quizzes" },
  { type: "GAME", icon: "🎮", labelKey: "learn.games" },
] as const;

export default function TenantLearnPage() {
  const params = useParams();
  const slug = typeof params.tenant === "string" ? params.tenant : "";
  const router = useRouter();
  const { t } = useI18n();
  const { tenant, branding, isLoading: tenantLoading } = useTenant();
  const { user, loading: userLoading } = useUser();

  const [paths, setPaths] = useState<Path[]>([]);
  const [contentByType, setContentByType] = useState<Record<string, ContentItem[]>>({});
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [courseEnrollments, setCourseEnrollments] = useState<CourseEnrollment[]>([]);
  const [points, setPoints] = useState(0);
  const [badges, setBadges] = useState<{ id: string; name: string; icon: string; earnedAt: string }[]>([]);
  const [streak, setStreak] = useState({ currentStreak: 0, longestStreak: 0 });
  const [loading, setLoading] = useState(true);
  const [celebration, setCelebration] = useState<{ certId: string; pathName: string; domainName: string } | null>(null);

  const userId = user?.id;
  const academyName = branding?.appName || tenant?.name || "Academy";

  useEffect(() => {
    if (!userLoading && !user) {
      router.replace(`/${slug}/signin?redirect=/${slug}/learn`);
    }
  }, [userLoading, user, router, slug]);

  const fetchContent = useCallback(async () => {
    if (!userId) return;

    try {
      const [pathsRes, contentRes, courseEnrollRes, pathEnrollRes] = await Promise.all([
        apiFetch("/learning-paths").then((r) => r.json()).catch(() => []),
        apiFetch("/content").then((r) => r.json()).catch(() => []),
        apiFetch(`/course-enrollments/user/${userId}`).then((r) => r.json()).catch(() => []),
        apiFetch(`/learning-paths/user/${userId}/enrollments`).then((r) => r.json()).catch(() => []),
      ]);

      const pathsList: Path[] = Array.isArray(pathsRes) ? pathsRes : [];
      setPaths(pathsList);

      const contentList: ContentItem[] = Array.isArray(contentRes) ? contentRes : [];
      const grouped: Record<string, ContentItem[]> = {};
      for (const item of contentList) {
        if (!grouped[item.type]) grouped[item.type] = [];
        grouped[item.type].push(item);
      }
      setContentByType(grouped);

      const ceList = Array.isArray(courseEnrollRes) ? courseEnrollRes : [];
      setCourseEnrollments(
        ceList.map((e: { id: string; courseId: string; progressPct: number }) => ({
          id: e.id,
          courseId: e.courseId,
          progressPct: e.progressPct ?? 0,
        })),
      );

      const peList = Array.isArray(pathEnrollRes) ? pathEnrollRes : [];
      setEnrollments(
        peList.map((e: { id: string; pathId: string; progressPct: number; stepProgress: { stepId: string; status: string }[] }) => ({
          id: e.id,
          pathId: e.pathId,
          progressPct: e.progressPct ?? 0,
          stepProgress: e.stepProgress ?? [],
        })),
      );
    } catch {
      // errors handled per-call
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchContent();
    if (userId) {
      track("page_view", { page: "tenant_learn", tenant: slug });
    }
  }, [fetchContent, userId, slug]);

  useEffect(() => {
    if (!userId) return;
    apiFetch(`/gamification/points/${userId}`).then((r) => r.json()).then((d) => setPoints(d?.points ?? 0)).catch(() => {});
    apiFetch(`/gamification/badges/${userId}`).then((r) => r.json()).then((d) => setBadges(Array.isArray(d) ? d : [])).catch(() => {});
    apiFetch(`/gamification/streak/${userId}`).then((r) => r.json()).then(setStreak).catch(() => {});
  }, [userId]);

  const enroll = async (pathId: string) => {
    if (!userId) return;

    const applyEnrollment = (e: { id?: string; pathId?: string; progressPct?: number; stepProgress?: { stepId: string; status: string }[] }) => {
      if (!e?.id) return false;
      setEnrollments((prev) => {
        if (prev.some((x) => x.pathId === pathId)) return prev;
        return [...prev, { id: e.id!, pathId, progressPct: e.progressPct ?? 0, stepProgress: e.stepProgress ?? [] }];
      });
      track("ENROLLMENT", { userId, pathId });
      return true;
    };

    try {
      const res = await apiFetch(`/learning-paths/${pathId}/enroll`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        const e = await res.json();
        if (applyEnrollment(e)) return;
      }
    } catch { /* POST failed */ }

    try {
      const fallback = await apiFetch(`/learning-paths/${pathId}/enrollment/${userId}`);
      if (fallback.ok) {
        const e = await fallback.json();
        applyEnrollment(e);
      }
    } catch { /* fallback also failed */ }
  };

  const enrollCourse = async (courseId: string) => {
    if (!userId) return;
    const res = await apiFetch(`/course-enrollments/${courseId}/enroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const e = await res.json();
    setCourseEnrollments((prev) => [...prev, { id: e.id, courseId, progressPct: 0 }]);
    track("COURSE_ENROLLMENT", { userId, courseId });
  };

  const tenantNav = useMemo(() => tenantLearnerNavItems(t, slug, user), [t, slug, user]);

  if (tenantLoading || userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
        <div className="h-10 w-10 rounded-full border-4 border-[var(--color-accent)] border-t-transparent animate-spin" />
      </div>
    );
  }

  const totalContent = Object.values(contentByType).reduce((sum, items) => sum + items.length, 0);

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <AppBurgerHeader
        borderClassName="border-b border-[var(--color-bg-secondary)]"
        logoHref={`/${slug}`}
        logo={<TenantLogo logoUrl={tenant?.logoUrl} name={academyName} size="md" />}
        title={academyName}
        items={tenantNav}
      />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome + Gamification */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">
            {t("learn.welcomeBack", { name: user?.name?.split(" ")[0] ?? "" })}
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mb-6">
            {t("learn.catalogSummary", { paths: paths.length, content: totalContent })}
          </p>
          <PointsBadgesStreaks
            points={points}
            badges={badges}
            currentStreak={streak.currentStreak}
            longestStreak={streak.longestStreak}
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-green border-t-transparent" />
          </div>
        ) : (
          <>
            {/* Learning Paths */}
            <ContentSection
              title={t("learn.learningPaths")}
              icon="🛤️"
              count={paths.length}
              isEmpty={paths.length === 0}
              emptyMessage={t("learn.noPaths")}
            >
              {paths.map((p) => {
                const enrollment = enrollments.find((e) => e.pathId === p.id);
                return (
                  <PathCard
                    key={p.id}
                    id={p.id}
                    name={p.name}
                    description={p.description}
                    domain={p.domain}
                    stepCount={p.steps?.length}
                    difficulty={p.difficulty}
                    enrolled={!!enrollment}
                    progressPct={enrollment?.progressPct}
                    href={`/${slug}/learn?path=${p.id}`}
                    onEnroll={() => enroll(p.id)}
                  />
                );
              })}
            </ContentSection>

            {/* Content by Type */}
            {CONTENT_CATEGORIES.map(({ type, icon, labelKey }) => {
              const items = contentByType[type] ?? [];
              if (items.length === 0) return null;
              return (
                <ContentSection
                  key={type}
                  title={t(labelKey)}
                  icon={icon}
                  count={items.length}
                  isEmpty={items.length === 0}
                >
                  {items.map((item) => {
                    const ce = item.type === "COURSE"
                      ? courseEnrollments.find((e) => e.courseId === item.id)
                      : undefined;
                    return (
                      <ContentCard
                        key={item.id}
                        id={item.id}
                        title={item.title}
                        type={item.type}
                        description={item.description}
                        durationMinutes={item.durationMinutes}
                        enrolled={!!ce}
                        progressPct={ce?.progressPct}
                        onEnroll={item.type === "COURSE" ? () => enrollCourse(item.id) : undefined}
                      />
                    );
                  })}
                </ContentSection>
              );
            })}

            {/* Empty state */}
            {paths.length === 0 && totalContent === 0 && (
              <div className="text-center py-20">
                <span className="text-5xl mb-4 block">📖</span>
                <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
                  {t("learn.emptyTitle")}
                </h2>
                <p className="text-sm text-[var(--color-text-secondary)] max-w-md mx-auto mb-6">
                  {t("learn.emptyDescription")}
                </p>
                <Link href={`/${slug}/discover`}>
                  <Button>{t("tenant.discover")}</Button>
                </Link>
              </div>
            )}
          </>
        )}
      </main>

      {celebration && (
        <CompletionCelebration
          certificateId={celebration.certId}
          pathName={celebration.pathName}
          domainName={celebration.domainName}
          onClose={() => setCelebration(null)}
        />
      )}
    </div>
  );
}
