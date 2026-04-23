"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LearnLogo } from "@/components/ui/learn-logo";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { PointsBadgesStreaks } from "@/components/gamification/points-badges-streaks";
import { ContentCard } from "@/components/learning/content-card";
import { ContentSection } from "@/components/learning/content-section";
import { PathCard } from "@/components/learning/path-card";
import { track } from "@/lib/analytics";
import { useUser } from "@/lib/use-user";
import { AppBurgerHeader } from "@/components/ui/app-burger-header";
import { globalLearnerNavItems } from "@/lib/nav/burger-nav";
import { apiFetch } from "@/lib/api";

type ContentItem = {
  id: string;
  title: string;
  type: string;
  description?: string | null;
  durationMinutes?: number | null;
  metadata?: Record<string, unknown> | string;
};

type Path = {
  id: string;
  name: string;
  description?: string | null;
  difficulty?: string | null;
  domain?: { id: string; name: string; slug: string } | string;
  steps?: { id: string }[];
};

type Enrollment = {
  id: string;
  pathId: string;
  progressPct: number;
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

export default function LearnPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { user, loading: userLoading } = useUser();

  const [paths, setPaths] = useState<Path[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [courseEnrollments, setCourseEnrollments] = useState<CourseEnrollment[]>([]);
  const [contentByType, setContentByType] = useState<Record<string, ContentItem[]>>({});
  const [points, setPoints] = useState(0);
  const [badges, setBadges] = useState<{ id: string; name: string; icon: string; earnedAt: string }[]>([]);
  const [streak, setStreak] = useState({ currentStreak: 0, longestStreak: 0 });
  const [loading, setLoading] = useState(true);

  const userId = user?.id;

  useEffect(() => {
    if (!userLoading && !user) {
      router.replace(`/signin?redirect=/learn`);
    }
  }, [userLoading, user, router]);

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
        peList.map((e: { id: string; pathId: string; progressPct: number }) => ({
          id: e.id,
          pathId: e.pathId,
          progressPct: e.progressPct ?? 0,
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
  }, [fetchContent]);

  useEffect(() => {
    if (!userId) return;

    apiFetch(`/gamification/points/${userId}`)
      .then((r) => r.json())
      .then((d) => setPoints(d?.points ?? 0))
      .catch(() => {});
    apiFetch(`/gamification/badges/${userId}`)
      .then((r) => r.json())
      .then((b: { badge: { name: string; icon: string }; earnedAt: string }[]) => {
        setBadges(
          (Array.isArray(b) ? b : []).map((x, i) => ({
            id: String(i),
            name: x.badge?.name ?? "",
            icon: x.badge?.icon ?? "🏆",
            earnedAt: x.earnedAt ?? "",
          }))
        );
      })
      .catch(() => {});
    apiFetch(`/gamification/streak/${userId}`)
      .then((r) => r.json())
      .then((s) => setStreak({ currentStreak: s?.currentStreak ?? 0, longestStreak: s?.longestStreak ?? 0 }))
      .catch(() => {});
  }, [userId]);

  const enroll = async (pathId: string) => {
    if (!userId) return;

    const applyEnrollment = (e: { id?: string; pathId?: string; progressPct?: number }) => {
      if (!e?.id) return false;
      setEnrollments((prev) => {
        if (prev.some((x) => x.pathId === pathId)) return prev;
        return [...prev, { id: e.id!, pathId, progressPct: e.progressPct ?? 0 }];
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

  const enrollCourse = (courseId: string) => {
    if (!userId) return;
    apiFetch(`/course-enrollments/${courseId}/enroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    })
      .then((r) => r.json())
      .then((e) => {
        setCourseEnrollments((prev) => [...prev, { id: e.id, courseId, progressPct: 0 }]);
        track("COURSE_ENROLLMENT", { userId, courseId });
      });
  };

  if (userLoading || !user) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0f1510] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-green border-t-transparent" />
          <p className="text-sm text-[var(--color-text-muted)]">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  const totalContent = Object.values(contentByType).reduce((sum, items) => sum + items.length, 0);

  return (
    <div className="min-h-screen bg-white dark:bg-[#0f1510]">
      <AppBurgerHeader
        logoHref="/"
        logo={<LearnLogo size="md" variant="purple" />}
        items={globalLearnerNavItems(t, user)}
        trailing={
          <Link
            href="/profile"
            className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-green to-brand-green-light flex items-center justify-center text-white text-xs font-bold hover:opacity-90 transition-opacity"
            title="My Profile"
          >
            {(user?.name ?? "").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
          </Link>
        }
      />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome + Gamification */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">
            {t("learn.welcomeBack", { name: user.name?.split(" ")[0] ?? "" })}
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
                    let thumbUrl: string | undefined;
                    try {
                      const m = typeof item.metadata === "string" ? JSON.parse(item.metadata || "{}") : (item.metadata ?? {});
                      const landing = m?.landingPage as Record<string, string> | undefined;
                      thumbUrl =
                        landing?.thumbnailUrl ||
                        (typeof m?.thumbnailUrl === "string" ? m.thumbnailUrl : undefined);
                    } catch {}
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
                        thumbnailUrl={thumbUrl}
                      />
                    );
                  })}
                </ContentSection>
              );
            })}

            {/* Empty state when nothing at all */}
            {paths.length === 0 && totalContent === 0 && (
              <div className="text-center py-20">
                <span className="text-5xl mb-4 block">📖</span>
                <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
                  {t("learn.emptyTitle")}
                </h2>
                <p className="text-sm text-[var(--color-text-secondary)] max-w-md mx-auto mb-6">
                  {t("learn.emptyDescription")}
                </p>
                <Link href="/discover">
                  <Button>{t("nav.discover")}</Button>
                </Link>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
