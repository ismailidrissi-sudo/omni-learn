"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LearnLogo } from "@/components/ui/learn-logo";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { PathProgress } from "@/components/learning/path-progress";
import { PointsBadgesStreaks } from "@/components/gamification/points-badges-streaks";
import { ImplementationGuideWizard } from "@/components/learning/implementation-guide-wizard";
import { Quiz } from "@/components/learning/quiz";
import { GameCard } from "@/components/learning/game-card";
import { track } from "@/lib/analytics";
import { useUser } from "@/lib/use-user";
import { NavToggles } from "@/components/ui/nav-toggles";
import { apiFetch } from "@/lib/api";
import { toast } from "@/lib/use-toast";

const WIZARD_STEPS = [
  { id: "1", title: "Define scope", content: "Identify the key areas and objectives for your implementation.", checklist: ["List stakeholders", "Define success criteria", "Set timeline"] },
  { id: "2", title: "Gather resources", content: "Collect templates and reference materials.", templateUrl: "#" },
  { id: "3", title: "Execute", content: "Follow the checklist and document your progress." },
];

const QUIZ_QUESTIONS = [
  { id: "q1", question: "What is the first step in the process?", options: [{ id: "a", text: "Define scope", correct: true }, { id: "b", text: "Execute", correct: false }, { id: "c", text: "Review", correct: false }] },
  { id: "q2", question: "Which is a best practice?", options: [{ id: "a", text: "Document as you go", correct: true }, { id: "b", text: "Document at the end", correct: false }] },
];

type Path = { id: string; name: string; domain?: { id: string; name: string; slug: string } | string; domainId?: string; steps?: { id: string; stepOrder: number; contentItem: { id: string; title: string; type: string }; isRequired?: boolean }[] };
type Enrollment = { id: string; progressPct: number; stepProgress: { stepId: string; status: string }[] };

export default function LearnPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { user, loading: userLoading } = useUser();
  const [view, setView] = useState<"progress" | "wizard" | "quiz" | "game">("progress");
  const [paths, setPaths] = useState<Path[]>([]);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [pathDetail, setPathDetail] = useState<Path | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
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

  useEffect(() => {
    if (!userId) return;
    apiFetch("/learning-paths")
      .then((r) => r.json())
      .then((p: Path[]) => {
        setPaths(Array.isArray(p) ? p : []);
        if (p?.length && !selectedPathId) setSelectedPathId(p[0].id);
      })
      .catch(() => setPaths([]))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    apiFetch(`/gamification/points/${userId}`)
      .then((r) => r.json())
      .then((d) => setPoints(d?.points ?? 0))
      .catch(() => {});
    apiFetch(`/gamification/badges/${userId}`)
      .then((r) => r.json())
      .then((b: { badge: { name: string; icon: string }; earnedAt: string }[]) => {
        setBadges((Array.isArray(b) ? b : []).map((x, i) => ({ id: String(i), name: x.badge?.name ?? "", icon: x.badge?.icon ?? "🏆", earnedAt: x.earnedAt ?? "" })));
      })
      .catch(() => {});
    apiFetch(`/gamification/streak/${userId}`)
      .then((r) => r.json())
      .then((s) => setStreak({ currentStreak: s?.currentStreak ?? 0, longestStreak: s?.longestStreak ?? 0 }))
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    if (!selectedPathId || !userId) return;
    apiFetch(`/learning-paths/${selectedPathId}`)
      .then((r) => r.json())
      .then(setPathDetail)
      .catch(() => setPathDetail(null));
    apiFetch(`/learning-paths/${selectedPathId}/enrollment/${userId}`)
      .then((r) => r.json())
      .then(setEnrollment)
      .catch(() => setEnrollment(null));
  }, [selectedPathId, userId]);

  const enroll = () => {
    if (!selectedPathId || !userId) return;
    apiFetch(`/learning-paths/${selectedPathId}/enroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    })
      .then((r) => r.json())
      .then((e) => {
        setEnrollment(e);
        track("ENROLLMENT", { userId, pathId: selectedPathId });
      });
  };

  const path = pathDetail ?? paths.find((p) => p.id === selectedPathId);
  const pathSteps = (path as { steps?: { id: string; stepOrder: number; contentItem: { id: string; title: string; type: string }; isRequired?: boolean }[] })?.steps ?? [];
  const stepsWithProgress = pathSteps
    .sort((a, b) => a.stepOrder - b.stepOrder)
    .map((s) => {
      const sp = enrollment?.stepProgress?.find((x: { stepId: string }) => x.stepId === s.id);
      return {
        id: s.contentItem.id,
        title: s.contentItem.title,
        type: s.contentItem.type,
        status: (sp?.status ?? "NOT_STARTED") as "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED",
        isRequired: s.isRequired ?? true,
        contentItem: s.contentItem,
      };
    });

  const updateStepProgress = (contentId: string, stepId: string, status: string) => {
    if (!enrollment?.id) return;
    apiFetch(`/learning-paths/enrollments/${enrollment.id}/steps/${stepId}/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
      .then(() => {
        setEnrollment((e) =>
          e
            ? {
                ...e,
                stepProgress: e.stepProgress.map((s) => (s.stepId === stepId ? { ...s, status } : s)),
              }
            : null
        );
        track("STEP_PROGRESS", { userId: userId ?? undefined, pathId: selectedPathId ?? undefined, contentId });
      });
  };

  const handleStepClick = (contentId: string) => {
    const step = path?.steps?.find((s) => s.contentItem.id === contentId);
    if (step && enrollment) updateStepProgress(contentId, step.id, "IN_PROGRESS");
    router.push(`/content/${contentId}`);
  };

  const addPoints = (pts: number, _reason: string) => {
    if (!userId) return;
    apiFetch(`/gamification/points`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, points: pts }),
    }).then(() => setPoints((p) => p + pts));
  };

  if (userLoading || !user) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0f1510] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-green border-t-transparent" />
          <p className="text-sm text-[var(--color-text-muted)]">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-brand-grey-light px-6 py-4 flex justify-between items-center">
        <Link href="/">
          <LearnLogo size="md" variant="purple" />
        </Link>
        <nav className="flex items-center gap-4">
          <div className="flex gap-4">
            <Button variant="ghost" size="sm" onClick={() => setView("progress")}>{t("nav.myProgress")}</Button>
            <Link href="/forum"><Button variant="ghost" size="sm">{t("nav.forums")}</Button></Link>
            <Link href="/discover"><Button variant="ghost" size="sm">{t("nav.discover")}</Button></Link>
            <Link href="/referrals"><Button variant="ghost" size="sm">Referrals</Button></Link>
            <Link href="/trainer"><Button variant="ghost" size="sm">{t("nav.trainer")}</Button></Link>
            {(user?.isAdmin || user?.planId === "NEXUS") && (
              <Link href="/admin/nexus"><Button variant="outline" size="sm">My Company</Button></Link>
            )}
            <Link href="/admin/paths"><Button variant="outline" size="sm">{t("nav.admin")}</Button></Link>
          </div>
          <div className="flex items-center gap-1 pl-4 ml-4 border-l border-brand-grey-light">
            <NavToggles />
          </div>
        </nav>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        <PointsBadgesStreaks points={points} badges={badges} currentStreak={streak.currentStreak} longestStreak={streak.longestStreak} />

        <div className="mt-8 flex gap-2 mb-6">
          <Button variant={view === "progress" ? "primary" : "ghost"} onClick={() => setView("progress")}>{t("learn.pathProgress")}</Button>
          <Button variant={view === "wizard" ? "primary" : "ghost"} onClick={() => setView("wizard")}>{t("learn.guideWizard")}</Button>
          <Button variant={view === "quiz" ? "primary" : "ghost"} onClick={() => setView("quiz")}>{t("learn.quiz")}</Button>
          <Button variant={view === "game" ? "primary" : "ghost"} onClick={() => setView("game")}>{t("learn.game")}</Button>
        </div>

        {view === "progress" && (
          <>
            {paths.length > 0 && (
              <div className="flex gap-2 mb-4">
                {paths.map((p) => (
                  <Button key={p.id} variant={selectedPathId === p.id ? "primary" : "ghost"} size="sm" onClick={() => setSelectedPathId(p.id)}>
                    {p.name}
                  </Button>
                ))}
              </div>
            )}
            {!enrollment && selectedPathId && (
              <div className="mb-4">
                <Button onClick={enroll}>{t("learn.enrollInPath")}</Button>
              </div>
            )}
            {enrollment && path && (
              <PathProgress
                pathName={path.name}
                progressPct={enrollment.progressPct}
                steps={stepsWithProgress}
                onStepClick={(contentId) => handleStepClick(contentId)}
              />
            )}
            {!loading && paths.length === 0 && (
              <p className="text-brand-grey">{t("learn.noPaths")}</p>
            )}
          </>
        )}
        {view === "wizard" && (
          <ImplementationGuideWizard
            title={t("learn.implementationGuide")}
            steps={WIZARD_STEPS}
            onComplete={() => {
              addPoints(50, "guide_complete");
              track("GUIDE_COMPLETE", { userId });
              toast(t("learn.guideComplete"), "success");
            }}
          />
        )}
        {view === "quiz" && (
          <Quiz
            title={t("learn.knowledgeCheck")}
            questions={QUIZ_QUESTIONS}
            passingScore={70}
            onComplete={(score, passed) => {
              const pts = passed ? 100 : Math.round(score);
              addPoints(pts, passed ? "quiz_passed" : "quiz_attempt");
              track("QUIZ_COMPLETE", { userId, score, passed });
              toast(`${passed ? t("learn.passed") : t("learn.notPassed")}: ${score}% — +${pts} ${t("learn.points")}`, passed ? "success" : "warning");
            }}
          />
        )}
        {view === "game" && (
          <GameCard
            title={t("learn.scenarioChallenge")}
            description={t("learn.scenarioDescription")}
            type="scenario"
            onComplete={(s) => {
              addPoints(s, "game_complete");
              track("GAME_COMPLETE", { userId, score: s });
              toast(`${t("learn.score")}: ${s} ${t("learn.points")}`, "success");
            }}
          />
        )}
      </main>
    </div>
  );
}
