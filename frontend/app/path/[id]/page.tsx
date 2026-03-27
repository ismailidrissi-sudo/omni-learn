"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { LearnLogo } from "@/components/ui/learn-logo";
import { useI18n } from "@/lib/i18n/context";
import { AppBurgerHeader } from "@/components/ui/app-burger-header";
import { globalLearnerNavItems } from "@/lib/nav/burger-nav";
import { useUser } from "@/lib/use-user";
import { apiFetch } from "@/lib/api";
import { learnerContentHref } from "@/lib/learner-content-href";
import { LearnerShareLinkButton } from "@/components/learning/learner-share-link-button";

type PathStep = {
  id: string;
  stepOrder: number;
  isRequired: boolean;
  contentItem: {
    id: string;
    title: string;
    type: string;
    description?: string | null;
    durationMinutes?: number | null;
    metadata?: Record<string, unknown>;
  };
};

type LearningPath = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  difficulty?: string | null;
  isPublished: boolean;
  domain?: { name: string } | null;
  steps: PathStep[];
};

type StepProgress = {
  stepId: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
};

type PathEnrollment = {
  id: string;
  progressPct: number;
  status: string;
  stepProgress: StepProgress[];
};

const DIFFICULTY_COLORS: Record<string, string> = {
  BEGINNER: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  INTERMEDIATE: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  ADVANCED: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
};

function getThumbnail(meta: Record<string, unknown> | undefined): string | null {
  if (!meta) return null;
  const landing = meta.landingPage as Record<string, string> | undefined;
  return landing?.thumbnailUrl || null;
}

export default function PathDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const { user } = useUser();
  const pathId = params?.id as string;

  const [path, setPath] = useState<LearningPath | null>(null);
  const [enrollment, setEnrollment] = useState<PathEnrollment | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    if (!pathId) return;
    apiFetch(`/learning-paths/${pathId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(setPath)
      .catch(() => setPath(null))
      .finally(() => setLoading(false));
  }, [pathId]);

  useEffect(() => {
    if (!user?.id || !pathId) return;
    apiFetch(`/learning-paths/${pathId}/enrollment/${user.id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) setEnrollment(data);
      })
      .catch(() => {});
  }, [user?.id, pathId]);

  const sortedSteps = (path?.steps ?? [])
    .filter((s) => s.contentItem)
    .sort((a, b) => a.stepOrder - b.stepOrder);
  const firstStep = sortedSteps[0]?.contentItem;
  const firstStepHref = firstStep
    ? learnerContentHref(firstStep.type, firstStep.id)
    : "/learn";

  const stepStatusMap = new Map(
    (enrollment?.stepProgress ?? []).map((sp) => [sp.stepId, sp.status])
  );

  const handleEnroll = async () => {
    if (!user) {
      router.push("/signin");
      return;
    }
    if (enrollment) {
      router.push(firstStepHref);
      return;
    }
    setEnrolling(true);
    try {
      const res = await apiFetch(`/learning-paths/${pathId}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setEnrollment(data);
      }
    } catch {} finally {
      setEnrolling(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <AppBurgerHeader
        logoHref="/"
        logo={<LearnLogo size="md" variant="purple" />}
        items={globalLearnerNavItems(t, user)}
        headerClassName="px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center gap-2"
      />

      <main className="max-w-5xl mx-auto px-4 py-4 sm:p-6">
        <Link href="/discover" className="text-brand-purple text-sm mb-4 inline-block">{t("path.backToDiscover")}</Link>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-purple border-t-transparent" />
          </div>
        ) : path ? (
          <div className="space-y-8">
            {/* Header */}
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-brand-purple/15 via-brand-green/10 to-brand-purple/5 p-8 sm:p-10">
              <div className="relative z-10">
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className="px-3 py-1 rounded-full bg-brand-purple/10 text-brand-purple text-xs font-semibold">{t("path.title")}</span>
                  {path.difficulty && (
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${DIFFICULTY_COLORS[path.difficulty] ?? "bg-gray-100 text-gray-700"}`}>
                      {path.difficulty}
                    </span>
                  )}
                  {path.domain && (
                    <span className="px-3 py-1 rounded-full bg-brand-green/10 text-brand-green text-xs font-semibold">
                      {typeof path.domain === "string" ? path.domain : path.domain.name}
                    </span>
                  )}
                </div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-brand-grey-dark dark:text-white mb-2">{path.name}</h1>
                {path.description && <p className="text-brand-grey dark:text-gray-400 max-w-2xl">{path.description}</p>}
                <p className="text-sm text-brand-grey dark:text-gray-500 mt-3">
                  {path.steps.length} {t("path.steps")}
                  {path.steps.reduce((acc, s) => acc + (s.contentItem?.durationMinutes ?? 0), 0) > 0 && (
                    <> &middot; {path.steps.reduce((acc, s) => acc + (s.contentItem?.durationMinutes ?? 0), 0)} min</>
                  )}
                </p>
              </div>
            </div>

            {/* Enrollment CTA */}
            <div className="flex flex-wrap items-center gap-4">
              <LearnerShareLinkButton
                path={`/path/${pathId}`}
                shareTitle={path.name}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-brand-grey-light dark:border-gray-600 text-brand-grey-dark dark:text-gray-200 font-semibold text-sm hover:bg-brand-grey-light/30 dark:hover:bg-gray-800/50 transition-colors"
              />
              {enrollment ? (
                <>
                  <span className="inline-flex items-center gap-2 text-sm text-brand-green font-medium">✓ {t("path.enrolled")}</span>
                  {enrollment.progressPct > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 bg-brand-green/10 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-green rounded-full transition-all" style={{ width: `${enrollment.progressPct}%` }} />
                      </div>
                      <span className="text-xs text-brand-grey font-medium">{enrollment.progressPct}%</span>
                    </div>
                  )}
                  <Link href={firstStepHref} className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-brand-purple text-white font-semibold hover:bg-brand-purple/90 transition">
                    {t("path.continueLearning")}
                  </Link>
                </>
              ) : (
                <button
                  onClick={handleEnroll}
                  disabled={enrolling}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-brand-purple text-white font-semibold hover:bg-brand-purple/90 transition disabled:opacity-60"
                >
                  {enrolling ? t("path.enrolling") : !user ? t("path.signInToEnroll") : t("path.enroll")}
                </button>
              )}
            </div>

            {/* Steps */}
            {path.steps.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-brand-grey-dark dark:text-white">{t("path.courseSteps")}</h2>
                <div className="relative">
                  {path.steps
                    .filter((step) => step.contentItem)
                    .sort((a, b) => a.stepOrder - b.stepOrder)
                    .map((step, idx, arr) => {
                      const ci = step.contentItem;
                      const thumb = getThumbnail(ci?.metadata);
                      const isCourse = ci?.type === "COURSE";
                      const typeLabel = ci?.type?.replace(/_/g, " ") ?? "";
                      const stepStatus = stepStatusMap.get(step.id);
                      const isCompleted = stepStatus === "COMPLETED";
                      const isInProgress = stepStatus === "IN_PROGRESS";
                      const isLast = idx === arr.length - 1;

                      const circleClass = isCompleted
                        ? "bg-brand-green text-white"
                        : isInProgress
                        ? "bg-white dark:bg-gray-900 border-2 border-brand-purple text-brand-purple"
                        : "bg-brand-purple/10 text-brand-purple";

                      const lineColor = isCompleted
                        ? "bg-brand-green"
                        : "bg-brand-grey-light dark:bg-gray-700";

                      return (
                        <div key={step.id} className="flex gap-0">
                          {/* Timeline column */}
                          <div className="flex flex-col items-center flex-shrink-0 w-8 mr-4">
                            <div className={`w-8 h-8 rounded-full font-bold text-sm flex items-center justify-center flex-shrink-0 transition-colors ${circleClass}`}>
                              {isCompleted ? (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                idx + 1
                              )}
                            </div>
                            {!isLast && (
                              <div className={`w-0.5 flex-1 min-h-[16px] ${lineColor} transition-colors`} />
                            )}
                          </div>

                          {/* Step card */}
                          <Link
                            href={learnerContentHref(ci?.type, ci.id)}
                            className={`flex items-start gap-4 p-4 rounded-xl border transition-all group flex-1 mb-3 ${
                              isCompleted
                                ? "border-brand-green/30 bg-brand-green/5 dark:bg-brand-green/5 hover:border-brand-green/50 hover:shadow-md"
                                : isInProgress
                                ? "border-brand-purple/30 bg-brand-purple/5 dark:bg-brand-purple/5 hover:border-brand-purple/50 hover:shadow-md"
                                : "border-brand-grey-light dark:border-gray-700 hover:border-brand-purple/40 hover:shadow-md"
                            }`}
                          >
                            {thumb ? (
                              <div className="flex-shrink-0 w-24 h-16 rounded-lg overflow-hidden">
                                <img src={thumb} alt="" className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="flex-shrink-0 w-24 h-16 rounded-lg bg-gradient-to-br from-brand-purple/10 to-brand-green/10 flex items-center justify-center text-2xl">
                                {isCourse ? "📚" : ci?.type === "VIDEO" ? "🎬" : ci?.type === "PODCAST" ? "🎧" : "📄"}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-semibold text-brand-grey-dark dark:text-white group-hover:text-brand-purple transition-colors line-clamp-1">
                                {ci.title}
                              </h3>
                              {ci.description && (
                                <p className="text-xs text-brand-grey dark:text-gray-400 line-clamp-2 mt-0.5">{ci.description}</p>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                {typeLabel && <span className="text-[10px] uppercase font-medium text-brand-purple">{typeLabel}</span>}
                                {ci.durationMinutes && (
                                  <span className="text-[10px] text-brand-grey">{ci.durationMinutes} min</span>
                                )}
                                {step.isRequired && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 font-medium">
                                    {t("pathProgress.required")}
                                  </span>
                                )}
                                {isCompleted && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-green/10 text-brand-green font-medium">
                                    {t("path.completed")}
                                  </span>
                                )}
                                {isInProgress && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-purple/10 text-brand-purple font-medium">
                                    {t("path.inProgress")}
                                  </span>
                                )}
                              </div>
                            </div>
                          </Link>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Bottom CTA */}
            {!enrollment && (
              <div className="rounded-xl bg-brand-purple/5 dark:bg-brand-purple/10 border border-brand-purple/20 p-6 text-center space-y-3">
                <h3 className="text-lg font-semibold text-brand-grey-dark dark:text-white">{path.name}</h3>
                <button
                  onClick={handleEnroll}
                  disabled={enrolling}
                  className="inline-flex items-center gap-2 px-8 py-3 rounded-lg bg-brand-purple text-white font-semibold hover:bg-brand-purple/90 transition disabled:opacity-60"
                >
                  {enrolling ? t("path.enrolling") : !user ? t("path.signInToEnroll") : t("path.enroll")}
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-brand-grey py-20 text-center">{t("path.notFound")}</p>
        )}
      </main>
    </div>
  );
}
