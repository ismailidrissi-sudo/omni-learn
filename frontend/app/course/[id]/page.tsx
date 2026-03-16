"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { LearnLogo } from "@/components/ui/learn-logo";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { SmartVideo } from "@/components/media/smart-video";
import { AudioPlayer } from "@/components/media/audio-player";
import { DocumentViewer } from "@/components/media/document-viewer";
import { NavToggles } from "@/components/ui/nav-toggles";
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

const ITEM_ICONS: Record<string, string> = {
  VIDEO: "🎬",
  AUDIO: "🎧",
  DOCUMENT: "📄",
  QUIZ: "✅",
  ARTICLE: "📝",
  CODING_EXERCISE: "💻",
};

export default function CoursePlayerPage() {
  const params = useParams();
  const { t } = useI18n();
  const courseId = params?.id as string;

  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [sections, setSections] = useState<CourseSection[]>([]);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (!courseId) return;
    Promise.all([
      apiFetch(`/content/${courseId}`).then((r) => r.json()),
      apiFetch(`/curriculum/courses/${courseId}`).then((r) => r.json()),
    ])
      .then(([courseData, curriculumData]) => {
        setCourse(courseData);
        const secs = Array.isArray(curriculumData) ? curriculumData : [];
        setSections(secs);
        // Expand first section and select first item
        if (secs.length > 0) {
          setExpandedSections(new Set([secs[0].id]));
          if (secs[0].items.length > 0) {
            setActiveItemId(secs[0].items[0].id);
          }
        }
      })
      .catch(() => {
        setCourse(null);
        setSections([]);
      })
      .finally(() => setLoading(false));
  }, [courseId]);

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

  const goToItem = (itemId: string) => {
    setActiveItemId(itemId);
    const parentSection = sections.find((s) =>
      s.items.some((i) => i.id === itemId),
    );
    if (parentSection) {
      setExpandedSections((prev) => new Set([...prev, parentSection.id]));
    }
  };

  const goNext = () => {
    if (activeIndex < totalItems - 1) goToItem(allItems[activeIndex + 1].id);
  };

  const goPrev = () => {
    if (activeIndex > 0) goToItem(allItems[activeIndex - 1].id);
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const renderLesson = () => {
    if (!activeItem) {
      return (
        <div className="flex items-center justify-center h-full text-brand-grey p-12">
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

    const meta = (activeItem.metadata ?? {}) as Record<string, unknown>;
    const url = activeItem.contentUrl ?? "";

    switch (activeItem.itemType) {
      case "VIDEO":
        return url ? (
          <SmartVideo src={url} title={activeItem.title} />
        ) : (
          <EmptyState label="No video URL set" />
        );

      case "AUDIO":
        return url ? (
          <AudioPlayer audioUrl={url} title={activeItem.title} />
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
        const questions = (meta.questions ?? []) as Array<{
          id: string;
          question: string;
          options: string[];
          correctIndex: number;
        }>;
        return questions.length > 0 ? (
          <QuizPlayer questions={questions} title={activeItem.title} />
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
      <header className="border-b border-brand-grey-light px-4 py-3 flex items-center gap-4 bg-white shrink-0 z-10">
        <Link href="/">
          <LearnLogo size="sm" variant="purple" />
        </Link>
        <div className="h-6 w-px bg-brand-grey-light" />
        <h1 className="text-sm font-semibold text-brand-grey-dark truncate flex-1">
          {course.title}
        </h1>
        <div className="flex items-center gap-2 text-sm text-brand-grey shrink-0">
          <span>
            {activeIndex + 1} / {totalItems}
          </span>
          {totalDuration > 0 && <span>&middot; {totalDuration} min</span>}
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg hover:bg-brand-grey-light/50 text-brand-grey"
          title={t("content.courseContents")}
        >
          ☰
        </button>
        <NavToggles />
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Main content area */}
        <main className="flex-1 min-w-0 flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 lg:p-6">
            <div className="max-w-4xl mx-auto">
              {renderLesson()}
            </div>
          </div>

          {/* Bottom navigation bar */}
          {totalItems > 0 && (
            <div className="border-t border-brand-grey-light px-4 py-3 flex items-center justify-between bg-white shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={goPrev}
                disabled={activeIndex <= 0}
              >
                ← Previous
              </Button>
              <div className="text-sm text-brand-grey-dark font-medium truncate max-w-xs mx-4">
                {activeItem?.title}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={goNext}
                disabled={activeIndex >= totalItems - 1}
              >
                Next →
              </Button>
            </div>
          )}
        </main>

        {/* Sidebar - Course Contents */}
        {sidebarOpen && (
          <aside className="w-80 shrink-0 border-l border-brand-grey-light bg-white overflow-y-auto">
            <div className="p-4 border-b border-brand-grey-light">
              <h2 className="font-semibold text-brand-grey-dark text-sm">
                {t("content.courseContents")}
              </h2>
              <p className="text-xs text-brand-grey mt-1">
                {sections.length} sections &middot; {totalItems} lessons
                {totalDuration > 0 && ` · ${totalDuration} min`}
              </p>
            </div>

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
                          const icon = ITEM_ICONS[item.itemType] ?? "📄";

                          return (
                            <button
                              key={item.id}
                              className={`w-full text-left px-4 py-2.5 flex items-start gap-3 transition-colors ${
                                isActive
                                  ? "bg-brand-purple/10 border-l-2 border-brand-purple"
                                  : "hover:bg-brand-grey-light/30 border-l-2 border-transparent"
                              }`}
                              onClick={() => goToItem(item.id)}
                            >
                              <span className="text-sm mt-0.5 shrink-0">{icon}</span>
                              <div className="flex-1 min-w-0">
                                <p
                                  className={`text-sm truncate ${
                                    isActive
                                      ? "font-medium text-brand-purple"
                                      : "text-brand-grey-dark"
                                  }`}
                                >
                                  {item.title}
                                </p>
                                <p className="text-xs text-brand-grey mt-0.5">
                                  {item.itemType.replace("_", " ")}
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

            <div className="p-4 border-t border-brand-grey-light">
              <Link
                href={`/content/${courseId}`}
                className="text-sm text-brand-purple hover:underline"
              >
                {t("content.backToLearn")}
              </Link>
            </div>
          </aside>
        )}
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
}: {
  questions: Array<{
    id: string;
    question: string;
    options: string[];
    correctIndex: number;
  }>;
  title: string;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const score = questions.reduce((acc, q) => {
    return acc + (answers[q.id] === q.correctIndex ? 1 : 0);
  }, 0);

  return (
    <div className="rounded-lg border border-brand-grey-light bg-white p-6 space-y-6">
      <h3 className="text-lg font-semibold text-brand-grey-dark">{title}</h3>

      {questions.map((q, qIdx) => {
        const selected = answers[q.id];
        return (
          <div key={q.id} className="space-y-3">
            <p className="font-medium text-brand-grey-dark">
              {qIdx + 1}. {q.question}
            </p>
            <div className="space-y-2 pl-4">
              {q.options.map((opt, oIdx) => {
                const isCorrect = oIdx === q.correctIndex;
                const isSelected = selected === oIdx;
                let optClass =
                  "border-brand-grey-light hover:border-brand-purple/50";
                if (submitted) {
                  if (isCorrect) optClass = "border-green-500 bg-green-50";
                  else if (isSelected && !isCorrect)
                    optClass = "border-red-500 bg-red-50";
                } else if (isSelected) {
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
                      checked={isSelected}
                      onChange={() => {
                        if (!submitted)
                          setAnswers((prev) => ({ ...prev, [q.id]: oIdx }));
                      }}
                      disabled={submitted}
                      className="shrink-0"
                    />
                    <span className="text-sm text-brand-grey-dark">{opt}</span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}

      {!submitted ? (
        <Button
          onClick={() => setSubmitted(true)}
          disabled={Object.keys(answers).length < questions.length}
        >
          Submit Quiz
        </Button>
      ) : (
        <div className="p-4 rounded-lg bg-brand-grey-light/30 border border-brand-grey-light">
          <p className="font-semibold text-brand-grey-dark">
            Score: {score} / {questions.length} (
            {Math.round((score / questions.length) * 100)}%)
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => {
              setAnswers({});
              setSubmitted(false);
            }}
          >
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}
