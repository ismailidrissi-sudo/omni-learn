"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { LearnLogo } from "@/components/ui/learn-logo";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { SmartVideo } from "@/components/media/smart-video";
import { AudioPlayer } from "@/components/media/audio-player";
import { DocumentViewer } from "@/components/media/document-viewer";
import { AppBurgerHeader } from "@/components/ui/app-burger-header";
import { globalLearnerNavItems } from "@/lib/nav/burger-nav";
import { useUser } from "@/lib/use-user";
import { apiFetch } from "@/lib/api";

type CourseSectionItem = {
  id: string;
  itemType: string;
  title: string;
  sortOrder: number;
  durationMinutes?: number | null;
  contentUrl?: string | null;
  metadata?: Record<string, unknown> | null;
};

type CourseSection = {
  id: string;
  title: string;
  learningGoal?: string | null;
  sortOrder: number;
  items: CourseSectionItem[];
};

type CourseInfo = {
  id: string;
  title: string;
  description?: string | null;
  type: string;
};

type EnrollmentContext = {
  enrollmentId: string;
  stepId: string;
  stepStatus: string;
  pathName: string;
  domainName: string;
  progressPct: number;
  certificate: { id: string; verifyCode: string } | null;
  enrollmentType: 'path' | 'course';
};

type CourseEnrollmentContext = {
  enrollmentId: string;
  enrollmentType: 'course';
  courseTitle: string;
  domainName: string;
  progressPct: number;
  status: string;
  certificate: { id: string; verifyCode: string } | null;
};

const ITEM_ICONS: Record<string, string> = {
  VIDEO: "🎬",
  AUDIO: "🎧",
  DOCUMENT: "📄",
  QUIZ: "✅",
  ARTICLE: "📝",
  CODING_EXERCISE: "💻",
};

function parseLessonMetadata(metadata: CourseSectionItem["metadata"]): Record<string, unknown> {
  if (metadata == null) return {};
  if (typeof metadata === "string") {
    try {
      return JSON.parse(metadata) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return typeof metadata === "object" ? (metadata as Record<string, unknown>) : {};
}

/** Coerce API/stored quiz correctIndex (number or numeric string) so learner check matches selected index. */
function normalizeQuizCorrectIndex(value: unknown, optionCount: number): number {
  let n = 0;
  if (typeof value === "number" && Number.isFinite(value)) {
    n = Math.trunc(value);
  } else if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) n = Math.trunc(parsed);
  }
  const max = Math.max(0, optionCount - 1);
  if (optionCount === 0) return 0;
  return Math.min(Math.max(0, n), max);
}

function normalizeCourseQuizQuestions(meta: Record<string, unknown>): Array<{
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
}> {
  const raw = meta.questions;
  if (!Array.isArray(raw)) return [];
  const out: Array<{
    id: string;
    question: string;
    options: string[];
    correctIndex: number;
  }> = [];
  let idx = 0;
  for (const q of raw) {
    if (q == null || typeof q !== "object") continue;
    const o = q as Record<string, unknown>;
    const options = Array.isArray(o.options) ? o.options.map((x) => String(x ?? "")) : [];
    const ci = normalizeQuizCorrectIndex(o.correctIndex, options.length);
    out.push({
      id: String(o.id ?? `q-${idx}`),
      question: String(o.question ?? ""),
      options,
      correctIndex: ci,
    });
    idx += 1;
  }
  return out;
}

export default function CoursePlayerPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useI18n();
  const { user } = useUser();
  const learnerNav = useMemo(() => globalLearnerNavItems(t, user), [t, user]);
  const courseId = params?.id as string;
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [sections, setSections] = useState<CourseSection[]>([]);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [enrollCtx, setEnrollCtx] = useState<EnrollmentContext | null>(null);
  const [visitedItems, setVisitedItems] = useState<Set<string>>(new Set());
  const [completing, setCompleting] = useState(false);
  const [courseCompleted, setCourseCompleted] = useState(false);
  const [pathProgress, setPathProgress] = useState<{
    pathCompleted: boolean;
    totalSteps: number;
    completedSteps: number;
  } | null>(null);
  const startTime = useRef(Date.now());
  const [passedQuizItemIds, setPassedQuizItemIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    setSidebarOpen(mql.matches);
    const handler = (e: MediaQueryListEvent) => setSidebarOpen(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (searchParams?.get("fullscreen") === "true" && !isFullscreen) {
      const el = document.documentElement;
      if (el.requestFullscreen) {
        el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
      }
    }
  }, [searchParams]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  useEffect(() => {
    if (!courseId) return;
    Promise.all([
      apiFetch(`/content/${courseId}`).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
      apiFetch(`/curriculum/courses/${courseId}`).then((r) => r.ok ? r.json() : []),
    ])
      .then(([courseData, curriculumData]) => {
        setCourse(courseData);
        const secs = Array.isArray(curriculumData) ? curriculumData : [];
        setSections(secs);
        if (secs.length > 0) {
          setExpandedSections(new Set([secs[0].id]));
          const firstItems = Array.isArray(secs[0]?.items) ? secs[0].items : [];
          if (firstItems.length > 0) {
            setActiveItemId(firstItems[0].id);
            setVisitedItems(new Set([firstItems[0].id]));
          }
        }
      })
      .catch(() => {
        setCourse(null);
        setSections([]);
      })
      .finally(() => setLoading(false));
  }, [courseId]);

  useEffect(() => {
    if (!user?.id || !courseId) return;

    const applyPathEnrollment = (data: EnrollmentContext | null) => {
      if (!data) return false;
      setEnrollCtx({ ...data, enrollmentType: 'path' });
      if (data.stepStatus === "COMPLETED") {
        setCourseCompleted(true);
      }
      return true;
    };

    const applyCourseEnrollment = (data: CourseEnrollmentContext | null) => {
      if (!data) return false;
      setEnrollCtx({
        enrollmentId: data.enrollmentId,
        stepId: '',
        stepStatus: data.status === 'COMPLETED' ? 'COMPLETED' : 'NOT_STARTED',
        pathName: data.courseTitle,
        domainName: data.domainName,
        progressPct: data.progressPct,
        certificate: data.certificate,
        enrollmentType: 'course',
      });
      if (data.status === 'COMPLETED') {
        setCourseCompleted(true);
      }
      return true;
    };

    const tryPathEnrollment = async (): Promise<boolean> => {
      try {
        const r = await apiFetch(`/learning-paths/enrollment-for-content?userId=${user.id}&contentId=${courseId}`);
        const data = r.ok ? await r.json() : null;
        if (data) return applyPathEnrollment(data);

        const autoR = await apiFetch("/learning-paths/auto-enroll-for-content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id, contentId: courseId }),
        });
        const autoData = autoR.ok ? await autoR.json() : null;
        if (autoData) return applyPathEnrollment(autoData);
      } catch {}
      return false;
    };

    const tryCourseEnrollment = async (): Promise<boolean> => {
      try {
        const r = await apiFetch(`/course-enrollments/for-course?userId=${user.id}&courseId=${courseId}`);
        const data = r.ok ? await r.json() : null;
        if (data) return applyCourseEnrollment(data);

        const enrollR = await apiFetch(`/course-enrollments/${courseId}/enroll`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id }),
        });
        if (enrollR.ok) {
          const freshR = await apiFetch(`/course-enrollments/for-course?userId=${user.id}&courseId=${courseId}`);
          const freshData = freshR.ok ? await freshR.json() : null;
          if (freshData) return applyCourseEnrollment(freshData);
        }
      } catch {}
      return false;
    };

    (async () => {
      const pathFound = await tryPathEnrollment();
      if (!pathFound) {
        await tryCourseEnrollment();
      }
    })();
  }, [user?.id, courseId]);

  const allItems = useMemo(
    () => sections.flatMap((s) => s.items),
    [sections],
  );

  const activeItem = useMemo(
    () => allItems.find((i) => i.id === activeItemId) ?? null,
    [allItems, activeItemId],
  );

  const activeIndex = useMemo(
    () => allItems.findIndex((i) => i.id === activeItemId),
    [allItems, activeItemId],
  );

  const totalItems = allItems.length;
  const totalDuration = allItems.reduce(
    (acc, i) => acc + (i.durationMinutes ?? 0),
    0,
  );
  const isLastItem = activeIndex === totalItems - 1;

  const activeQuizQuestionCount = useMemo(() => {
    if (activeItem?.itemType !== "QUIZ") return 0;
    const meta = parseLessonMetadata(activeItem.metadata);
    return normalizeCourseQuizQuestions(meta).length;
  }, [activeItem]);

  const quizBlocksNext = useMemo(
    () =>
      activeItem?.itemType === "QUIZ" &&
      activeQuizQuestionCount > 0 &&
      activeItemId != null &&
      !passedQuizItemIds.has(activeItemId),
    [activeItem?.itemType, activeQuizQuestionCount, activeItemId, passedQuizItemIds],
  );

  const goToItem = useCallback((itemId: string) => {
    setActiveItemId(itemId);
    setVisitedItems((prev) => new Set([...prev, itemId]));
    const parentSection = sections.find((s) =>
      s.items.some((i) => i.id === itemId),
    );
    if (parentSection) {
      setExpandedSections((prev) => new Set([...prev, parentSection.id]));
    }
  }, [sections]);

  const goNext = useCallback(() => {
    if (activeIndex < totalItems - 1) goToItem(allItems[activeIndex + 1].id);
  }, [activeIndex, totalItems, allItems, goToItem]);

  const goPrev = useCallback(() => {
    if (activeIndex > 0) goToItem(allItems[activeIndex - 1].id);
  }, [activeIndex, allItems, goToItem]);

  const completeCourse = useCallback(async () => {
    if (!enrollCtx || completing || courseCompleted) return;
    setCompleting(true);
    try {
      const timeSpentMinutes = Math.round((Date.now() - startTime.current) / 60000);

      if (enrollCtx.enrollmentType === 'path') {
        const res = await apiFetch(
          `/learning-paths/enrollments/${enrollCtx.enrollmentId}/steps/${enrollCtx.stepId}/progress`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status: "COMPLETED",
              timeSpent: timeSpentMinutes,
            }),
          },
        );

        if (!res.ok) return;
        const result = await res.json();
        setCourseCompleted(true);

        if (result.totalSteps != null) {
          setPathProgress({
            pathCompleted: result.pathCompleted ?? false,
            totalSteps: result.totalSteps,
            completedSteps: result.completedSteps ?? 0,
          });
        }

        const pathVerify =
          (result.certificate as { verifyCode?: string } | null)?.verifyCode;
        if (pathVerify) {
          router.push(`/certificates/verify/${encodeURIComponent(pathVerify)}`);
        } else if (result.pathCompleted && !result.certificate) {
          const certRes = await apiFetch(
            `/learning-paths/enrollment-for-content?userId=${user?.id}&contentId=${courseId}`,
          );
          if (certRes.ok) {
            const data = await certRes.json();
            const code = data?.certificate?.verifyCode as string | undefined;
            if (code) {
              router.push(`/certificates/verify/${encodeURIComponent(code)}`);
            }
          }
        }
      } else {
        // Course enrollment: mark all section items as completed
        const enrollRes = await apiFetch(`/course-enrollments/${courseId}/enrollment/${user?.id}`);
        if (!enrollRes.ok) return;
        const enrollData = await enrollRes.json();
        const itemProgressList = enrollData?.itemProgress ?? [];

        for (const ip of itemProgressList) {
          if (ip.status !== 'COMPLETED') {
            await apiFetch(
              `/course-enrollments/enrollments/${enrollCtx.enrollmentId}/items/${ip.sectionItemId}/progress`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  status: "COMPLETED",
                  timeSpent: Math.round(timeSpentMinutes / (itemProgressList.length || 1)),
                }),
              },
            );
          }
        }

        setCourseCompleted(true);

        const freshRes = await apiFetch(`/course-enrollments/for-course?userId=${user?.id}&courseId=${courseId}`);
        if (freshRes.ok) {
          const fresh = await freshRes.json();
          const courseVerify = fresh?.certificate?.verifyCode as string | undefined;
          if (courseVerify) {
            router.push(`/certificates/verify/${encodeURIComponent(courseVerify)}`);
          }
        }
      }
    } catch {
      // allow retry on failure
    } finally {
      setCompleting(false);
    }
  }, [enrollCtx, completing, courseCompleted, user?.id, courseId, router]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const handleContentCompleted = useCallback(() => {
    if (activeIndex < totalItems - 1) {
      setTimeout(() => goNext(), 1200);
    }
  }, [activeIndex, totalItems, goNext]);

  const renderLesson = () => {
    if (!activeItem) {
      return (
        <div className="flex items-center justify-center text-brand-grey p-12">
          <div className="text-center">
            <p className="text-lg mb-2">
              {totalItems === 0
                ? t("content.noLessons")
                : t("content.selectLesson")}
            </p>
          </div>
        </div>
      );
    }

    const meta = parseLessonMetadata(activeItem.metadata);
    const url = activeItem.contentUrl ?? "";

    switch (activeItem.itemType) {
      case "VIDEO":
        return url ? (
          <SmartVideo
            src={url}
            title={activeItem.title}
            contentId={activeItem.id}
            userId={user?.id}
            onEnded={handleContentCompleted}
            onComplete={() => {}}
          />
        ) : (
          <EmptyState label="No video URL set" />
        );

      case "AUDIO":
        return url ? (
          <AudioPlayer audioUrl={url} title={activeItem.title} onEnded={handleContentCompleted} />
        ) : (
          <EmptyState label="No audio URL set" />
        );

      case "DOCUMENT":
        return url ? (
          <DocumentViewer fileUrl={url} title={activeItem.title} />
        ) : (
          <EmptyState label="No document URL set" />
        );

      case "ARTICLE": {
        const content = (meta.content as string) ?? "";
        return content ? (
          <div className="prose max-w-none p-6 bg-white rounded-lg border border-brand-grey-light">
            <h3 className="text-brand-grey-dark font-semibold mb-4">
              {activeItem.title}
            </h3>
            <div className="whitespace-pre-wrap text-brand-grey-dark leading-relaxed">
              {content}
            </div>
          </div>
        ) : (
          <EmptyState label="No article content" />
        );
      }

      case "QUIZ": {
        const questions = normalizeCourseQuizQuestions(meta);
        return questions.length > 0 ? (
          <QuizPlayer
            key={activeItem.id}
            questions={questions}
            title={activeItem.title}
            initialPassed={passedQuizItemIds.has(activeItem.id)}
            onQuizFullyPassed={() => {
              setPassedQuizItemIds((prev) => new Set(prev).add(activeItem.id));
            }}
            onCompleted={handleContentCompleted}
          />
        ) : (
          <EmptyState label="No quiz questions" />
        );
      }

      case "CODING_EXERCISE":
        return url ? (
          <div className="rounded-lg border border-brand-grey-light overflow-hidden min-h-[500px]">
            <iframe
              src={url}
              title={activeItem.title}
              className="w-full min-h-[600px] border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          </div>
        ) : (
          <EmptyState label="No exercise URL set" />
        );

      default:
        return <EmptyState label={`Unsupported type: ${activeItem.itemType}`} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-brand-grey">{t("common.loading")}</p>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-brand-grey">{t("content.contentNotFound")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top bar */}
      <AppBurgerHeader
        borderClassName="border-b border-brand-grey-light bg-white shrink-0 z-20"
        headerClassName="px-3 sm:px-4 py-3 flex items-center gap-2 sm:gap-4"
        logoHref="/"
        logo={<LearnLogo size="sm" variant="purple" />}
        items={learnerNav}
        center={
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
            <div className="h-6 w-px bg-brand-grey-light hidden sm:block shrink-0" />
            <h1 className="text-xs sm:text-sm font-semibold text-brand-grey-dark truncate flex-1 min-w-0 text-left">
              {course.title}
            </h1>
            <div className="hidden sm:flex items-center gap-2 text-sm text-brand-grey shrink-0">
              <span>
                {activeIndex + 1} / {totalItems}
              </span>
              {totalDuration > 0 && <span>&middot; {totalDuration} min</span>}
            </div>
          </div>
        }
        beforeMenu={
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (isFullscreen) {
                  document.exitFullscreen?.();
                } else {
                  document.documentElement.requestFullscreen?.().catch(() => {});
                }
              }}
              className="p-2 rounded-lg hover:bg-brand-grey-light/50 text-brand-grey"
              title={isFullscreen ? t("content.fullscreenExit") : t("content.fullscreenEnter")}
            >
              {isFullscreen ? "⊠" : "⊡"}
            </button>
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-brand-grey-light/50 text-brand-grey"
              title={t("content.courseContents")}
            >
              ☰
            </button>
          </div>
        }
      />

      <div className="flex flex-1 min-h-0 relative">
        {/* Main content area */}
        <main className="flex-1 min-w-0 overflow-y-auto w-full">
          <div className="max-w-5xl mx-auto">
            {/* Content rendered flush (no extra padding around video) */}
            <div className="sm:px-4 lg:px-6">
              {renderLesson()}
            </div>

            {/* Navigation bar directly under content */}
            {totalItems > 0 && (
              <div className="px-3 sm:px-4 lg:px-6 py-3 mt-1">
                <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={goPrev}
                    disabled={activeIndex <= 0}
                  >
                    ← <span className="hidden sm:inline">{t("content.previous")}</span>
                  </Button>

                  <div className="flex-1 min-w-0 text-center">
                    {activeItem && (
                      <p className="text-sm text-brand-grey-dark font-medium truncate">
                        {activeItem.title}
                      </p>
                    )}
                    <p className="text-xs text-brand-grey mt-0.5">
                      {activeIndex + 1} / {totalItems}
                      {totalDuration > 0 && ` · ${totalDuration} min`}
                    </p>
                    {quizBlocksNext && (
                      <p className="text-xs text-amber-700 mt-1">{t("content.quizNextLocked")}</p>
                    )}
                  </div>

              {isLastItem && enrollCtx && !courseCompleted ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={completeCourse}
                  disabled={completing || quizBlocksNext}
                >
                  {completing ? t("common.loading") : t("content.completeCourse")}
                </Button>
              ) : isLastItem && courseCompleted ? (
                <div className="flex items-center gap-3 flex-wrap justify-end">
                  <span className="text-sm font-medium text-green-600 flex items-center gap-1">
                    ✓ {t("content.courseCompleted")}
                  </span>
                  {pathProgress && !pathProgress.pathCompleted && (
                    <span className="text-xs text-brand-grey">
                      {t("content.pathStepsRemaining", {
                        completed: pathProgress.completedSteps,
                        total: pathProgress.totalSteps,
                      })}
                    </span>
                  )}
                  {enrollCtx?.certificate?.verifyCode && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const code = enrollCtx.certificate?.verifyCode;
                        if (code) {
                          router.push(`/certificates/verify/${encodeURIComponent(code)}`);
                        }
                      }}
                    >
                      {t("certificate.viewCertificate")}
                    </Button>
                  )}
                  {pathProgress && !pathProgress.pathCompleted && (
                    <Link href="/learn">
                      <Button variant="outline" size="sm">
                        {t("content.backToLearn")}
                      </Button>
                    </Link>
                  )}
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goNext}
                  disabled={activeIndex >= totalItems - 1 || quizBlocksNext}
                >
                  <span className="hidden sm:inline">{t("content.next")}</span> →
                </Button>
              )}
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Sidebar backdrop on mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar - Course Contents */}
        <aside
          className={`
            fixed top-0 right-0 h-full w-[85vw] max-w-sm z-40 bg-white shadow-xl
            transform transition-transform duration-200 ease-in-out
            lg:relative lg:w-80 lg:max-w-none lg:shadow-none lg:z-0
            lg:border-l lg:border-brand-grey-light
            ${sidebarOpen
              ? "translate-x-0"
              : "translate-x-full lg:hidden"
            }
          `}
        >
          <div className="flex items-center justify-between p-4 border-b border-brand-grey-light">
            <div>
              <h2 className="font-semibold text-brand-grey-dark text-sm">
                {t("content.courseContents")}
              </h2>
              <p className="text-xs text-brand-grey mt-1">
                {sections.length} sections &middot; {totalItems} lessons
                {totalDuration > 0 && ` · ${totalDuration} min`}
              </p>
            </div>
            <button
              className="lg:hidden p-2 rounded-lg hover:bg-brand-grey-light/50 text-brand-grey"
              onClick={() => setSidebarOpen(false)}
            >
              ✕
            </button>
          </div>

          <div className="overflow-y-auto h-[calc(100%-8rem)]">
            <div className="divide-y divide-brand-grey-light">
              {sections.map((section, sIdx) => {
                const isExpanded = expandedSections.has(section.id);
                const sectionDuration = section.items.reduce(
                  (acc, i) => acc + (i.durationMinutes ?? 0),
                  0,
                );

                return (
                  <div key={section.id}>
                    <button
                      className="w-full text-left px-4 py-3 hover:bg-brand-grey-light/30 transition-colors"
                      onClick={() => toggleSection(section.id)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-brand-grey text-xs">
                          {isExpanded ? "▼" : "▶"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-brand-grey-dark truncate">
                            Section {sIdx + 1}: {section.title}
                          </p>
                          <p className="text-xs text-brand-grey mt-0.5">
                            {section.items.length} lessons
                            {sectionDuration > 0 && ` · ${sectionDuration} min`}
                          </p>
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="bg-brand-grey-light/10">
                        {section.items.map((item) => {
                          const isActive = item.id === activeItemId;
                          const isVisited = visitedItems.has(item.id);
                          const icon = ITEM_ICONS[item.itemType] ?? "📄";

                          return (
                            <button
                              key={item.id}
                              className={`w-full text-left px-4 py-2.5 flex items-start gap-3 transition-colors ${
                                isActive
                                  ? "bg-brand-purple/10 border-l-2 border-brand-purple"
                                  : "hover:bg-brand-grey-light/30 border-l-2 border-transparent"
                              }`}
                              onClick={() => {
                                goToItem(item.id);
                                if (window.innerWidth < 1024) setSidebarOpen(false);
                              }}
                            >
                              <span className="text-sm mt-0.5 shrink-0">
                                {isVisited && !isActive ? (
                                  <span className="text-green-500">✓</span>
                                ) : (
                                  icon
                                )}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p
                                  className={`text-sm truncate ${
                                    isActive
                                      ? "font-medium text-brand-purple"
                                      : isVisited
                                        ? "text-brand-grey-dark/70"
                                        : "text-brand-grey-dark"
                                  }`}
                                >
                                  {item.title}
                                </p>
                                <p className="text-xs text-brand-grey mt-0.5">
                                  {(item.itemType ?? "LESSON").replace(/_/g, " ")}
                                  {item.durationMinutes
                                    ? ` · ${item.durationMinutes} min`
                                    : ""}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-4 border-t border-brand-grey-light">
            <Link
              href={`/content/${courseId}`}
              className="text-sm text-brand-purple hover:underline"
            >
              {t("content.backToLearn")}
            </Link>
          </div>
        </aside>
      </div>

    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-brand-grey-light p-12 text-center text-brand-grey bg-brand-grey-light/10">
      <p>{label}</p>
    </div>
  );
}

function QuizPlayer({
  questions,
  title,
  onCompleted,
  initialPassed = false,
  onQuizFullyPassed,
}: {
  questions: Array<{
    id: string;
    question: string;
    options: string[];
    correctIndex: number;
  }>;
  title: string;
  onCompleted?: () => void;
  initialPassed?: boolean;
  onQuizFullyPassed?: () => void;
}) {
  const { t } = useI18n();
  const [finished, setFinished] = useState(initialPassed);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);

  useEffect(() => {
    setFinished(initialPassed);
    setStep(0);
    setSelected(null);
    setChecked(false);
    setFeedback(null);
  }, [initialPassed]);

  if (questions.length === 0) {
    return (
      <EmptyState label="No quiz questions" />
    );
  }

  if (finished) {
    return (
      <div className="rounded-lg border border-brand-grey-light bg-white p-6 space-y-3">
        <h3 className="text-lg font-semibold text-brand-grey-dark">{title}</h3>
        <p className="text-green-600 font-medium">{t("content.quizCompleted")}</p>
      </div>
    );
  }

  const q = questions[step];
  if (!q) {
    return <EmptyState label="No quiz questions" />;
  }
  const correctIdx = q.correctIndex;

  const handleCheck = () => {
    if (selected === null) return;
    const ok = selected === correctIdx;
    setChecked(true);
    setFeedback(ok ? "correct" : "wrong");
  };

  const handleNextInQuiz = () => {
    if (step >= questions.length - 1) {
      onQuizFullyPassed?.();
      setFinished(true);
      if (onCompleted) setTimeout(() => onCompleted(), 900);
      return;
    }
    setStep((s) => s + 1);
    setSelected(null);
    setChecked(false);
    setFeedback(null);
  };

  return (
    <div className="rounded-lg border border-brand-grey-light bg-white p-6 space-y-6">
      <h3 className="text-lg font-semibold text-brand-grey-dark">{title}</h3>
      <p className="text-xs text-brand-grey">
        {step + 1} / {questions.length}
      </p>

      <div className="space-y-3">
        <p className="font-medium text-brand-grey-dark">{q.question}</p>
        <div className="space-y-2 pl-1">
          {q.options.map((opt, oIdx) => {
            const isSel = selected === oIdx;
            let optClass = "border-brand-grey-light hover:border-brand-purple/50";
            if (checked && feedback === "correct") {
              if (oIdx === correctIdx) optClass = "border-green-500 bg-green-50";
            } else if (checked && feedback === "wrong") {
              if (oIdx === correctIdx) optClass = "border-green-500 bg-green-50";
              else if (isSel) optClass = "border-red-500 bg-red-50";
            } else if (isSel) {
              optClass = "border-brand-purple bg-brand-purple/5";
            }
            return (
              <label
                key={oIdx}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${optClass}`}
              >
                <input
                  type="radio"
                  name={`quiz-${q.id}`}
                  checked={isSel}
                  onChange={() => {
                    setSelected(oIdx);
                    if (checked) {
                      setChecked(false);
                      setFeedback(null);
                    }
                  }}
                  disabled={checked && feedback === "correct"}
                  className="shrink-0"
                />
                <span className="text-sm text-brand-grey-dark">{opt}</span>
              </label>
            );
          })}
        </div>
      </div>

      {feedback === "wrong" && (
        <p className="text-sm text-red-600 font-medium">{t("content.quizIncorrect")}</p>
      )}
      {feedback === "correct" && (
        <p className="text-sm text-green-600 font-medium">{t("content.quizCorrect")}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {!checked && (
          <Button onClick={handleCheck} disabled={selected === null}>
            {t("content.quizCheckAnswer")}
          </Button>
        )}
        {checked && feedback === "correct" && (
          <Button onClick={handleNextInQuiz}>
            {step >= questions.length - 1
              ? t("content.quizContinueNext")
              : t("content.quizNextQuestion")}
          </Button>
        )}
        {checked && feedback === "wrong" && (
          <p className="text-xs text-brand-grey w-full sm:w-auto">
            {t("content.quizPickAnotherToCheck")}
          </p>
        )}
      </div>
    </div>
  );
}
