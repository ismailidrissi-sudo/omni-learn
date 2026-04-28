"use client";

import { useState, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/context";
import { UrlPreview } from "@/components/admin/url-preview";
import { detectProvider, isExternalProvider, getProviderLabel } from "@/lib/video-provider";
import { apiFetch, apiUploadCourseThumbnail, apiAbsoluteMediaUrl } from "@/lib/api";
import { toast } from "@/lib/use-toast";
import { useParams } from "next/navigation";
import { useTenant } from "@/components/providers/tenant-context";
import { ExportButtons } from "@/components/ui/export-buttons";
import type { ColumnDef } from "@/lib/exports/list-export";

const ITEM_TYPES = [
  { type: "VIDEO", icon: "🎬", label: "Video" },
  { type: "AUDIO", icon: "🎧", label: "Audio" },
  { type: "DOCUMENT", icon: "📄", label: "Document" },
  { type: "QUIZ", icon: "✅", label: "Quiz" },
  { type: "CODING_EXERCISE", icon: "💻", label: "Coding Exercise" },
  { type: "ARTICLE", icon: "📝", label: "Article" },
] as const;

type CourseSection = {
  id: string;
  title: string;
  learningGoal?: string | null;
  sortOrder: number;
  items: CourseSectionItem[];
};

type CourseSectionItem = {
  id: string;
  itemType: string;
  title: string;
  sortOrder: number;
  durationMinutes?: number | null;
  contentUrl?: string | null;
  metadata?: unknown;
};

type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
};

function parseItemMetadata(item: CourseSectionItem): Record<string, unknown> {
  const m = item.metadata;
  if (m == null) return {};
  if (typeof m === "string") {
    try {
      return JSON.parse(m) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return typeof m === "object" ? (m as Record<string, unknown>) : {};
}

function normalizeQuizQuestionsFromMeta(raw: unknown): QuizQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((q): q is Record<string, unknown> => q != null && typeof q === "object")
    .map((o) => {
    let options = Array.isArray(o.options) ? o.options.map((x) => String(x ?? "")) : ["", ""];
    if (options.length < 2) {
      options = [...options, ...Array.from({ length: 2 - options.length }, () => "")];
    }
    let ci = 0;
    if (typeof o.correctIndex === "number" && Number.isFinite(o.correctIndex)) {
      ci = Math.trunc(o.correctIndex);
    } else if (typeof o.correctIndex === "string" && o.correctIndex.trim() !== "") {
      const parsed = Number(o.correctIndex);
      if (Number.isFinite(parsed)) ci = Math.trunc(parsed);
    }
    ci = Math.min(Math.max(0, ci), Math.max(0, options.length - 1));
    return {
      id: typeof o.id === "string" && o.id ? o.id : crypto.randomUUID(),
      question: String(o.question ?? ""),
      options,
      correctIndex: ci,
    };
  });
}

function validateQuizQuestionsForSave(
  questions: QuizQuestion[],
  t: (key: string, params?: Record<string, string | number>) => string,
): string | null {
  if (questions.length === 0) {
    return t("admin.courseQuizNeedQuestion");
  }
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q.question.trim()) {
      return t("admin.courseQuizInvalidQuestion", { n: i + 1 });
    }
    const filledCount = q.options.filter((o) => o.trim().length > 0).length;
    if (filledCount < 2) {
      return t("admin.courseQuizInvalidOptions", { n: i + 1 });
    }
    const ci = q.correctIndex;
    if (ci < 0 || ci >= q.options.length || !q.options[ci]?.trim()) {
      return t("admin.courseQuizInvalidCorrect", { n: i + 1 });
    }
  }
  return null;
}

function QuizQuestionsEditor({
  questions,
  setQuestions,
}: {
  questions: QuizQuestion[];
  setQuestions: Dispatch<SetStateAction<QuizQuestion[]>>;
}) {
  const { t } = useI18n();

  const addQuizQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        question: "",
        options: ["", ""],
        correctIndex: 0,
      },
    ]);
  };

  const updateQuizQuestion = (idx: number, updates: Partial<QuizQuestion>) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== idx) return q;
        const next = { ...q, ...updates };
        if (updates.options) {
          const len = updates.options.length;
          next.correctIndex = Math.min(Math.max(0, next.correctIndex), Math.max(0, len - 1));
        }
        return next;
      }),
    );
  };

  const removeQuizQuestion = (idx: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <label className="text-sm font-medium text-brand-grey-dark">
          {t("admin.courseQuizQuestions")}
        </label>
        <Button variant="ghost" size="sm" type="button" onClick={addQuizQuestion}>
          + {t("admin.courseAddQuestion")}
        </Button>
      </div>
      <p className="text-xs text-brand-grey mb-3">{t("admin.courseCorrectAnswer")}</p>
      <div className="space-y-4">
        {questions.map((q, idx) => (
          <div
            key={q.id}
            className="p-4 rounded-lg border border-brand-grey-light bg-white"
          >
            <div className="flex justify-between items-start mb-2">
              <span className="text-sm font-medium text-brand-grey">
                {t("admin.courseQuestion")} {idx + 1}
              </span>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                className="text-red-600"
                onClick={() => removeQuizQuestion(idx)}
              >
                ×
              </Button>
            </div>
            <Input
              placeholder={t("admin.courseQuestionPlaceholder")}
              value={q.question}
              onChange={(e) => updateQuizQuestion(idx, { question: e.target.value })}
              className="mb-2"
            />
            <div className="space-y-2">
              {q.options.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${q.id}`}
                    title={t("admin.courseCorrectAnswer")}
                    aria-label={`${t("admin.courseCorrectAnswer")} — ${t("admin.courseOption")} ${oi + 1}`}
                    checked={q.correctIndex === oi}
                    onChange={() => updateQuizQuestion(idx, { correctIndex: oi })}
                  />
                  <Input
                    value={opt}
                    onChange={(e) => {
                      const opts = [...q.options];
                      opts[oi] = e.target.value;
                      updateQuizQuestion(idx, { options: opts });
                    }}
                    placeholder={`${t("admin.courseOption")} ${oi + 1}`}
                    className="flex-1"
                  />
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() =>
                  updateQuizQuestion(idx, {
                    options: [...q.options, ""],
                  })
                }
              >
                + {t("admin.courseAddOption")}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface CourseBuilderProps {
  courseId: string;
  courseTitle: string;
  onBack: () => void;
}

function getPreviewEnabled(item: CourseSectionItem): boolean {
  const meta = item.metadata as Record<string, unknown> | undefined;
  return meta?.previewEnabled === true;
}

type SidebarTab =
  | "curriculum" | "targets" | "landing" | "subtitles" | "accessibility"
  | "pricing" | "promotions" | "messages" | "availability" | "participants";

type CourseMetadata = Record<string, unknown>;

export function CourseBuilder({ courseId, courseTitle, onBack }: CourseBuilderProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<SidebarTab>("curriculum");
  const [sections, setSections] = useState<CourseSection[]>([]);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<{ sectionId: string; itemId: string } | null>(null);
  const [itemDropdownOpen, setItemDropdownOpen] = useState<string | null>(null);

  const [courseData, setCourseData] = useState<{
    description?: string;
    metadata?: CourseMetadata;
  }>({});

  // New section form
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSectionGoal, setNewSectionGoal] = useState("");

  // New item form (per section)
  const [newItemSectionId, setNewItemSectionId] = useState<string | null>(null);
  const [newItemType, setNewItemType] = useState<"VIDEO" | "AUDIO" | "DOCUMENT" | "QUIZ" | "ARTICLE" | "CODING_EXERCISE">("VIDEO");
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemUrl, setNewItemUrl] = useState("");
  const [newItemDuration, setNewItemDuration] = useState("");
  const [newItemQuestions, setNewItemQuestions] = useState<QuizQuestion[]>([]);
  const [newItemContent, setNewItemContent] = useState("");

  const loadCurriculum = () => {
    apiFetch(`/curriculum/courses/${courseId}`)
      .then((r) => r.json())
      .then((data) => setSections(Array.isArray(data) ? data : []))
      .catch(() => setSections([]));
  };

  const loadCourseData = () => {
    apiFetch(`/content/${courseId}?admin=true`)
      .then((r) => r.json())
      .then((data) => {
        const meta = typeof data.metadata === "string"
          ? JSON.parse(data.metadata || "{}")
          : (data.metadata ?? {});
        setCourseData({ description: data.description ?? "", metadata: meta });
      })
      .catch(() => {});
  };

  const saveCourseMetadata = (key: string, value: unknown) => {
    const meta = { ...(courseData.metadata ?? {}), [key]: value };
    apiFetch(`/content/${courseId}`, {
      method: "PUT",
      body: JSON.stringify({ metadata: meta }),
    })
      .then(() => {
        setCourseData((prev) => ({ ...prev, metadata: meta }));
        toast(t("common.saved"), "success");
      })
      .catch(() => toast("Failed to save", "error"));
  };

  const saveCourseField = (field: string, value: unknown) => {
    apiFetch(`/content/${courseId}`, {
      method: "PUT",
      body: JSON.stringify({ [field]: value }),
    })
      .then(() => {
        setCourseData((prev) => ({ ...prev, [field]: value }));
        toast(t("common.saved"), "success");
      })
      .catch(() => toast("Failed to save", "error"));
  };

  useEffect(() => {
    loadCurriculum();
    loadCourseData();
  }, [courseId]);

  const addSection = async () => {
    if (!newSectionTitle.trim()) return;
    try {
      const res = await apiFetch(`/curriculum/courses/${courseId}/sections`, {
        method: "POST",
        body: JSON.stringify({
          title: newSectionTitle.trim(),
          learningGoal: newSectionGoal.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.message || `Failed to add section (${res.status})`);
      }
      setNewSectionTitle("");
      setNewSectionGoal("");
      loadCurriculum();
    } catch (e) {
      console.error(e);
      toast(e instanceof Error ? e.message : "Failed to add section", "error");
    }
  };

  const updateSection = (sectionId: string, updates: { title?: string; learningGoal?: string }) => {
    apiFetch(`/curriculum/sections/${sectionId}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    })
      .then(loadCurriculum)
      .catch(console.error);
  };

  const deleteSection = (sectionId: string) => {
    if (!confirm(t("admin.courseDeleteSectionConfirm"))) return;
    apiFetch(`/curriculum/sections/${sectionId}`, { method: "DELETE" })
      .then(loadCurriculum)
      .catch(console.error);
  };

  const openAddItem = (sectionId: string) => {
    setNewItemSectionId(sectionId);
    setNewItemType("VIDEO");
    setNewItemTitle("");
    setNewItemUrl("");
    setNewItemDuration("");
    setNewItemQuestions([]);
    setNewItemContent("");
    setExpandedSection(sectionId);
  };

  const addItem = () => {
    if (!newItemSectionId || !newItemTitle.trim()) return;

    if (newItemType === "QUIZ") {
      const err = validateQuizQuestionsForSave(newItemQuestions, t);
      if (err) {
        toast(err, "error");
        return;
      }
    }

    const metadata: Record<string, unknown> = {};
    if (newItemType === "QUIZ") {
      metadata.questions = newItemQuestions.map((q) => ({
        id: q.id,
        question: q.question.trim(),
        options: q.options.map((o) => o.trim()),
        correctIndex: q.correctIndex,
      }));
    }
    if (newItemType === "ARTICLE") {
      metadata.content = newItemContent;
    }

    apiFetch(`/curriculum/sections/${newItemSectionId}/items`, {
      method: "POST",
      body: JSON.stringify({
        itemType: newItemType,
        title: newItemTitle.trim(),
        durationMinutes: newItemDuration ? parseInt(newItemDuration, 10) : undefined,
        contentUrl: newItemUrl || undefined,
        metadata: Object.keys(metadata).length ? metadata : undefined,
      }),
    })
      .then(() => {
        setNewItemSectionId(null);
        setNewItemTitle("");
        setNewItemUrl("");
        setNewItemDuration("");
        setNewItemQuestions([]);
        setNewItemContent("");
        loadCurriculum();
      })
      .catch(console.error);
  };

  const updateItem = (itemId: string, updates: Record<string, unknown>) => {
    apiFetch(`/curriculum/sections/items/${itemId}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    })
      .then(() => {
        setEditingItem(null);
        setItemDropdownOpen(null);
        loadCurriculum();
      })
      .catch(console.error);
  };

  const togglePreview = (item: CourseSectionItem) => {
    const meta = (item.metadata as Record<string, unknown>) || {};
    updateItem(item.id, {
      metadata: { ...meta, previewEnabled: !getPreviewEnabled(item) },
    });
  };

  const deleteItem = (itemId: string) => {
    if (!confirm(t("admin.courseDeleteItemConfirm"))) return;
    apiFetch(`/curriculum/sections/items/${itemId}`, { method: "DELETE" })
      .then(() => {
        setItemDropdownOpen(null);
        loadCurriculum();
      })
      .catch(console.error);
  };

  const totalItems = sections.reduce((acc, s) => acc + s.items.length, 0);
  const totalDuration = sections.reduce(
    (acc, s) =>
      acc +
      s.items.reduce((a, i) => a + (i.durationMinutes ?? 0), 0),
    0
  );

  const sidebarNav: { key: SidebarTab; label: string }[] = [
    { key: "curriculum", label: t("admin.curriculumTitle") },
    { key: "targets", label: t("admin.curriculumTargetParticipants") },
    { key: "landing", label: t("admin.curriculumLandingPage") },
    { key: "subtitles", label: t("admin.curriculumSubtitles") },
    { key: "accessibility", label: t("admin.curriculumAccessibility") },
  ];
  const managementNav: { key: SidebarTab; label: string }[] = [
    { key: "pricing", label: t("admin.curriculumPricing") },
    { key: "promotions", label: t("admin.curriculumPromotions") },
    { key: "messages", label: t("admin.curriculumMessages") },
    { key: "availability", label: t("admin.curriculumAvailability") },
    { key: "participants", label: t("admin.curriculumParticipants") },
  ];

  return (
    <div className="flex min-h-[calc(100vh-80px)]">
      {/* Left sidebar - Udemy-style */}
      <aside className="w-64 shrink-0 border-r border-brand-grey-light bg-white">
        <div className="sticky top-4 p-4 space-y-6">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-grey mb-2">
              {t("admin.curriculumCourseModification")}
            </h3>
            <nav className="space-y-0.5">
              {sidebarNav.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setActiveTab(item.key)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    activeTab === item.key
                      ? "bg-brand-purple/10 text-brand-purple border-l-4 border-brand-purple -ml-1 pl-4"
                      : "text-brand-grey-dark hover:bg-brand-grey-light/50"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-grey mb-2">
              {t("admin.curriculumCourseManagement")}
            </h3>
            <nav className="space-y-0.5">
              {managementNav.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setActiveTab(item.key)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    activeTab === item.key
                      ? "bg-brand-purple/10 text-brand-purple border-l-4 border-brand-purple -ml-1 pl-4"
                      : "text-brand-grey-dark hover:bg-brand-grey-light/50"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 p-6 lg:p-8">
        <div className="max-w-4xl">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-2xl font-bold text-brand-grey-dark">
                {[...sidebarNav, ...managementNav].find((n) => n.key === activeTab)?.label ?? t("admin.curriculumTitle")}
              </h1>
              <p className="text-sm text-brand-grey mt-1">
                {courseTitle} · {sections.length} {t("admin.courseSections")} · {totalItems} {t("admin.curriculumSession")}s · {totalDuration} min
              </p>
            </div>
            <div className="flex gap-2">
              {activeTab === "curriculum" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-brand-grey"
                  onClick={() => toast("Bulk upload coming soon", "info")}
                >
                  {t("admin.curriculumBulkUpload")}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={onBack}>
                {t("common.back")}
              </Button>
            </div>
          </div>

          {activeTab === "curriculum" && (<>
          {/* Add Section - Udemy-style */}
          <Card className="mb-6 p-4">
            <h3 className="font-semibold text-brand-grey-dark mb-3">{t("admin.courseAddSection")}</h3>
            <div className="flex gap-3 flex-wrap">
              <Input
                placeholder={t("admin.courseSectionTitlePlaceholder")}
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                className="flex-1 min-w-[200px]"
              />
              <Input
                placeholder={t("admin.courseSectionGoalPlaceholder")}
                value={newSectionGoal}
                onChange={(e) => setNewSectionGoal(e.target.value)}
                className="flex-1 min-w-[200px]"
              />
              <Button onClick={addSection} disabled={!newSectionTitle.trim()}>
                {t("admin.courseAddSection")}
              </Button>
            </div>
          </Card>

          {/* Instructional text - Udemy-style */}
          <div className="mb-6 p-4 rounded-lg bg-brand-grey-light/30 border border-brand-grey-light">
            <p className="text-sm text-brand-grey-dark leading-relaxed">
              {t("admin.curriculumInstruction")}
            </p>
          </div>

          {/* Sections - Udemy-style */}
          <div className="space-y-4">
            {sections.map((section, sectionIdx) => (
              <div
                key={section.id}
                className="border border-brand-grey-light rounded-lg bg-white"
              >
                {/* Section header */}
                <div
                  className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-brand-grey-light/20 transition-colors ${
                    expandedSection === section.id ? "rounded-t-lg" : "rounded-lg"
                  }`}
                  onClick={() =>
                    setExpandedSection(expandedSection === section.id ? null : section.id)
                  }
                >
                  <span className="text-brand-grey text-lg">
                    {expandedSection === section.id ? "▼" : "▶"}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newTitle = prompt(t("admin.courseSectionTitlePlaceholder"), section.title);
                      if (newTitle?.trim()) updateSection(section.id, { title: newTitle.trim() });
                    }}
                    className="flex-1 text-left group flex items-center gap-2"
                  >
                    <h3 className="font-semibold text-brand-grey-dark group-hover:text-brand-purple">
                      {t("admin.curriculumSection")} {sectionIdx + 1}: {section.title}
                    </h3>
                    <span className="text-brand-grey opacity-0 group-hover:opacity-100 transition-opacity" title={t("admin.curriculumEditSection")}>
                      ✎
                    </span>
                  </button>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openAddItem(section.id)}
                    >
                      + {t("admin.courseAddItem")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => deleteSection(section.id)}
                    >
                      {t("common.delete")}
                    </Button>
                  </div>
                </div>

                {/* Section content - sessions */}
                {expandedSection === section.id && (
                  <div className="border-t border-brand-grey-light bg-brand-grey-light/10 rounded-b-lg">
                    {section.learningGoal && (
                      <div className="px-4 py-2 text-sm text-brand-grey">
                        {section.learningGoal}
                      </div>
                    )}
                    <div className="p-4 space-y-2">
                      {section.items.map((item) => {
                        const it = ITEM_TYPES.find((i) => i.type === item.itemType);
                        const isEditing = editingItem?.sectionId === section.id && editingItem?.itemId === item.id;
                        const previewOn = getPreviewEnabled(item);
                        const dropdownOpen = itemDropdownOpen === item.id;
                        return (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 p-3 rounded-lg bg-white border border-brand-grey-light hover:border-brand-purple/30 transition-colors group"
                          >
                            {/* Checkmark - Udemy-style */}
                            <span className="text-green-600 text-lg shrink-0" title="Ready">
                              ✓
                            </span>
                            <span className="text-xl shrink-0">{it?.icon ?? "📄"}</span>
                            <div className="flex-1 min-w-0">
                              {isEditing ? (
                                <ItemEditor
                                  item={item}
                                  onSave={(updates) => updateItem(item.id, updates)}
                                  onCancel={() => setEditingItem(null)}
                                />
                              ) : (
                                <>
                                  <p className="font-medium text-brand-grey-dark truncate">
                                    {item.title}
                                  </p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {previewOn && (
                                      <span className="text-xs text-brand-purple font-medium">
                                        ({t("admin.curriculumPreviewEnabled")})
                                      </span>
                                    )}
                                    <span className="text-xs text-brand-grey">
                                      {item.itemType.replace("_", " ")}
                                      {item.durationMinutes && ` · ${item.durationMinutes} min`}
                                    </span>
                                    {item.contentUrl && item.itemType === "VIDEO" && (() => {
                                      const d = detectProvider(item.contentUrl!);
                                      return isExternalProvider(d.provider) ? (
                                        <span className="text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">
                                          {getProviderLabel(d.provider)}
                                        </span>
                                      ) : null;
                                    })()}
                                  </div>
                                </>
                              )}
                            </div>
                            {!isEditing && (
                              <div className="relative shrink-0">
                                <button
                                  onClick={() => setItemDropdownOpen(dropdownOpen ? null : item.id)}
                                  className="p-2 rounded-lg hover:bg-brand-grey-light/50 text-brand-grey"
                                  aria-label="Options"
                                >
                                  ⋮
                                </button>
                                {dropdownOpen && (
                                  <>
                                    <div
                                      className="fixed inset-0 z-10"
                                      onClick={() => setItemDropdownOpen(null)}
                                    />
                                    <div className="absolute right-0 top-full mt-1 z-20 w-48 py-1 rounded-lg border border-brand-grey-light bg-white shadow-lg">
                                      <button
                                        className="w-full text-left px-4 py-2 text-sm hover:bg-brand-grey-light/50"
                                        onClick={() => {
                                          setEditingItem({ sectionId: section.id, itemId: item.id });
                                          setItemDropdownOpen(null);
                                        }}
                                      >
                                        {t("common.edit")}
                                      </button>
                                      <button
                                        className="w-full text-left px-4 py-2 text-sm hover:bg-brand-grey-light/50"
                                        onClick={() => togglePreview(item)}
                                      >
                                        {previewOn ? "Disable preview" : "Enable preview"}
                                      </button>
                                      <button
                                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                        onClick={() => deleteItem(item.id)}
                                      >
                                        {t("common.delete")}
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* + Curriculum Item - Udemy-style purple button */}
          <div className="mt-6">
            <Button
              variant="primary"
              size="lg"
              className="w-full py-4"
              onClick={() => {
                if (sections.length === 0) {
                  if (newSectionTitle.trim()) {
                    addSection();
                  } else {
                    setNewSectionTitle("Section 1");
                    setNewSectionGoal("");
                  }
                } else {
                  openAddItem(sections[sections.length - 1].id);
                }
              }}
            >
              + {t("admin.curriculumAddItem")}
            </Button>
          </div>

          {/* Add Item form (when adding to a section) */}
          {newItemSectionId && (
            <Card className="mt-6 p-6 border-2 border-brand-purple">
              <h3 className="font-semibold text-brand-grey-dark mb-4">
                {t("admin.courseAddItem")}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-brand-grey-dark mb-2">
                    {t("admin.contentType")}
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {ITEM_TYPES.map((it) => (
                      <button
                        key={it.type}
                        onClick={() => setNewItemType(it.type as typeof newItemType)}
                        className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          newItemType === it.type
                            ? "border-brand-purple bg-brand-purple/10 text-brand-purple"
                            : "border-brand-grey-light hover:border-brand-purple/50"
                        }`}
                      >
                        {it.icon} {it.label}
                      </button>
                    ))}
                  </div>
                </div>

                <Input
                  label={t("admin.name")}
                  value={newItemTitle}
                  onChange={(e) => setNewItemTitle(e.target.value)}
                  placeholder={t("admin.courseItemTitlePlaceholder")}
                />

                {(newItemType === "VIDEO" || newItemType === "AUDIO") && (
                  <>
                    <Input
                      label={newItemType === "VIDEO" ? t("admin.courseVideoUrl") : "Audio URL"}
                      value={newItemUrl}
                      onChange={(e) => setNewItemUrl(e.target.value)}
                      placeholder={newItemType === "VIDEO" ? "https://youtube.com/watch?v=... or https://vimeo.com/... or direct URL" : "https://...mp3 or audio URL"}
                    />
                    {newItemType === "VIDEO" && <UrlPreview url={newItemUrl} type="video" />}
                    <Input
                      label={t("admin.durationMinutes")}
                      value={newItemDuration}
                      onChange={(e) => setNewItemDuration(e.target.value)}
                      placeholder="e.g. 15"
                    />
                  </>
                )}

                {newItemType === "DOCUMENT" && (
                  <Input
                    label={t("admin.courseDocumentUrl")}
                    value={newItemUrl}
                    onChange={(e) => setNewItemUrl(e.target.value)}
                    placeholder="https://...pdf or https://docs.google.com/... or document URL"
                  />
                )}

                {newItemType === "CODING_EXERCISE" && (
                  <Input
                    label="Exercise URL or description"
                    value={newItemUrl}
                    onChange={(e) => setNewItemUrl(e.target.value)}
                    placeholder="https://... or describe the coding exercise"
                  />
                )}

                {newItemType === "QUIZ" && (
                  <QuizQuestionsEditor
                    questions={newItemQuestions}
                    setQuestions={setNewItemQuestions}
                  />
                )}

                {newItemType === "ARTICLE" && (
                  <div>
                    <label className="block text-sm font-medium text-brand-grey-dark mb-2">
                      {t("admin.courseArticleContent")}
                    </label>
                    <textarea
                      value={newItemContent}
                      onChange={(e) => setNewItemContent(e.target.value)}
                      placeholder={t("admin.courseArticlePlaceholder")}
                      rows={6}
                      className="w-full px-4 py-2.5 rounded-lg border border-brand-grey-light bg-white"
                    />
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button onClick={addItem} disabled={!newItemTitle.trim()}>
                    {t("common.add")}
                  </Button>
                  <Button variant="ghost" onClick={() => setNewItemSectionId(null)}>
                    {t("common.back")}
                  </Button>
                </div>
              </div>
            </Card>
          )}
          </>)}

          {activeTab === "targets" && (
            <TargetParticipantsPanel
              metadata={courseData.metadata ?? {}}
              onSave={(val) => saveCourseMetadata("targetParticipants", val)}
            />
          )}

          {activeTab === "landing" && (
            <LandingPagePanel
              description={courseData.description ?? ""}
              metadata={courseData.metadata ?? {}}
              onSaveDescription={(val) => saveCourseField("description", val)}
              onSaveMetadata={(key, val) => saveCourseMetadata(key, val)}
            />
          )}

          {activeTab === "subtitles" && (
            <SubtitlesPanel
              metadata={courseData.metadata ?? {}}
              onSave={(val) => saveCourseMetadata("subtitles", val)}
            />
          )}

          {activeTab === "accessibility" && (
            <AccessibilityPanel
              metadata={courseData.metadata ?? {}}
              onSave={(val) => saveCourseMetadata("accessibility", val)}
            />
          )}

          {activeTab === "pricing" && (
            <PricingPanel
              metadata={courseData.metadata ?? {}}
              onSave={(val) => saveCourseMetadata("pricing", val)}
            />
          )}

          {activeTab === "promotions" && (
            <PromotionsPanel
              metadata={courseData.metadata ?? {}}
              onSave={(val) => saveCourseMetadata("promotions", val)}
            />
          )}

          {activeTab === "messages" && (
            <MessagesPanel
              metadata={courseData.metadata ?? {}}
              onSave={(val) => saveCourseMetadata("messages", val)}
            />
          )}

          {activeTab === "availability" && (
            <AvailabilityPanel
              metadata={courseData.metadata ?? {}}
              onSave={(val) => saveCourseMetadata("availability", val)}
            />
          )}

          {activeTab === "participants" && (
            <ParticipantsPanel courseId={courseId} />
          )}
        </div>
      </main>
    </div>
  );
}

function ItemEditor({
  item,
  onSave,
  onCancel,
}: {
  item: CourseSectionItem;
  onSave: (updates: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const baseMeta = parseItemMetadata(item);
  const [title, setTitle] = useState(item.title);
  const [url, setUrl] = useState(item.contentUrl ?? "");
  const [duration, setDuration] = useState(item.durationMinutes?.toString() ?? "");
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>(() =>
    normalizeQuizQuestionsFromMeta(baseMeta.questions),
  );

  if (item.itemType === "QUIZ") {
    return (
      <div className="space-y-3 w-full min-w-0">
        <Input
          label={t("admin.name")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("admin.courseItemTitlePlaceholder")}
        />
        <QuizQuestionsEditor questions={quizQuestions} setQuestions={setQuizQuestions} />
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            onClick={() => {
              const err = validateQuizQuestionsForSave(quizQuestions, t);
              if (err) {
                toast(err, "error");
                return;
              }
              onSave({
                title: title.trim(),
                metadata: {
                  ...baseMeta,
                  questions: quizQuestions.map((q) => ({
                    id: q.id,
                    question: q.question.trim(),
                    options: q.options.map((o) => o.trim()),
                    correctIndex: q.correctIndex,
                  })),
                },
              });
            }}
          >
            {t("common.save")}
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 w-full min-w-0">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("admin.courseItemTitlePlaceholder")}
      />
      {(item.itemType === "VIDEO" || item.itemType === "AUDIO" || item.itemType === "DOCUMENT" || item.itemType === "CODING_EXERCISE") && (
        <>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={item.itemType === "VIDEO" ? "https://youtube.com/watch?v=... or direct URL" : "URL"}
          />
          {item.itemType === "VIDEO" && <UrlPreview url={url} type="video" />}
          {(item.itemType === "VIDEO" || item.itemType === "AUDIO") && (
            <Input
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder={t("admin.durationMinutes")}
            />
          )}
        </>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() =>
            onSave({
              title: title.trim(),
              contentUrl: url || undefined,
              durationMinutes: duration ? parseInt(duration, 10) : undefined,
            })
          }
        >
          {t("common.save")}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
      </div>
    </div>
  );
}

/* ─── Target Participants Panel ─── */
function TargetParticipantsPanel({
  metadata,
  onSave,
}: {
  metadata: Record<string, unknown>;
  onSave: (val: unknown) => void;
}) {
  const { t } = useI18n();
  const saved = (metadata.targetParticipants ?? {}) as Record<string, string>;
  const [whoIs, setWhoIs] = useState(saved.whoIsThisCourseFor ?? "");
  const [prerequisites, setPrerequisites] = useState(saved.prerequisites ?? "");
  const [whatYouLearn, setWhatYouLearn] = useState(saved.whatYouWillLearn ?? "");

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="font-semibold text-brand-grey-dark mb-1">{t("admin.targetsWhoIs")}</h3>
        <p className="text-sm text-brand-grey mb-3">{t("admin.targetsWhoIsHint")}</p>
        <textarea
          value={whoIs}
          onChange={(e) => setWhoIs(e.target.value)}
          rows={4}
          className="w-full px-4 py-2.5 rounded-lg border border-brand-grey-light bg-white text-sm"
          placeholder={t("admin.targetsWhoIsPlaceholder")}
        />
      </Card>
      <Card className="p-6">
        <h3 className="font-semibold text-brand-grey-dark mb-1">{t("admin.targetsPrerequisites")}</h3>
        <p className="text-sm text-brand-grey mb-3">{t("admin.targetsPrerequisitesHint")}</p>
        <textarea
          value={prerequisites}
          onChange={(e) => setPrerequisites(e.target.value)}
          rows={4}
          className="w-full px-4 py-2.5 rounded-lg border border-brand-grey-light bg-white text-sm"
          placeholder={t("admin.targetsPrerequisitesPlaceholder")}
        />
      </Card>
      <Card className="p-6">
        <h3 className="font-semibold text-brand-grey-dark mb-1">{t("admin.targetsWhatYouLearn")}</h3>
        <p className="text-sm text-brand-grey mb-3">{t("admin.targetsWhatYouLearnHint")}</p>
        <textarea
          value={whatYouLearn}
          onChange={(e) => setWhatYouLearn(e.target.value)}
          rows={4}
          className="w-full px-4 py-2.5 rounded-lg border border-brand-grey-light bg-white text-sm"
          placeholder={t("admin.targetsWhatYouLearnPlaceholder")}
        />
      </Card>
      <Button
        onClick={() =>
          onSave({
            whoIsThisCourseFor: whoIs,
            prerequisites,
            whatYouWillLearn: whatYouLearn,
          })
        }
      >
        {t("common.save")}
      </Button>
    </div>
  );
}

/* ─── Course Landing Page Panel ─── */
function LandingPagePanel({
  description,
  metadata,
  onSaveDescription,
  onSaveMetadata,
}: {
  description: string;
  metadata: Record<string, unknown>;
  onSaveDescription: (val: string) => void;
  onSaveMetadata: (key: string, val: unknown) => void;
}) {
  const { t } = useI18n();
  const landing = (metadata.landingPage ?? {}) as Record<string, string>;
  const [desc, setDesc] = useState(description);
  const [subtitle, setSubtitle] = useState(landing.subtitle ?? "");
  const [promoVideoUrl, setPromoVideoUrl] = useState(landing.promoVideoUrl ?? "");
  const [thumbnailUrl, setThumbnailUrl] = useState(landing.thumbnailUrl ?? "");
  const [language, setLanguage] = useState(landing.language ?? "English");
  const [level, setLevel] = useState(landing.level ?? "All Levels");
  const [category, setCategory] = useState(landing.category ?? "");
  const thumbFileRef = useRef<HTMLInputElement>(null);
  const [thumbDragging, setThumbDragging] = useState(false);
  const [uploadingThumb, setUploadingThumb] = useState(false);

  const THUMB_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
  const MAX_THUMB_BYTES = 5 * 1024 * 1024;

  const handleThumbFile = async (file: File | undefined) => {
    if (!file) return;
    if (!THUMB_MIME.includes(file.type as (typeof THUMB_MIME)[number])) {
      toast(t("admin.landingThumbnailInvalidType"), "error");
      return;
    }
    if (file.size > MAX_THUMB_BYTES) {
      toast(t("admin.landingThumbnailTooLarge"), "error");
      return;
    }
    setUploadingThumb(true);
    try {
      const { url } = await apiUploadCourseThumbnail(file);
      setThumbnailUrl(url);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Upload failed", "error");
    } finally {
      setUploadingThumb(false);
    }
  };

  const handleSave = () => {
    onSaveDescription(desc);
    onSaveMetadata("landingPage", {
      subtitle,
      promoVideoUrl,
      thumbnailUrl,
      language,
      level,
      category,
    });
  };

  const thumbPreviewSrc =
    thumbnailUrl.trim().length > 0 ? (apiAbsoluteMediaUrl(thumbnailUrl) ?? thumbnailUrl) : "";

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="font-semibold text-brand-grey-dark mb-1">{t("admin.landingDescription")}</h3>
        <p className="text-sm text-brand-grey mb-3">{t("admin.landingDescriptionHint")}</p>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={6}
          className="w-full px-4 py-2.5 rounded-lg border border-brand-grey-light bg-white text-sm"
          placeholder={t("admin.landingDescriptionPlaceholder")}
        />
      </Card>
      <Card className="p-6 space-y-4">
        <div>
          <h3 className="font-semibold text-brand-grey-dark mb-1">{t("admin.landingSubtitle")}</h3>
          <Input
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder={t("admin.landingSubtitlePlaceholder")}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-brand-grey-dark mb-1">{t("admin.landingLanguage")}</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-brand-grey-light bg-white text-sm"
            >
              <option>English</option>
              <option>French</option>
              <option>Spanish</option>
              <option>German</option>
              <option>Arabic</option>
              <option>Portuguese</option>
              <option>Chinese</option>
              <option>Japanese</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-grey-dark mb-1">{t("admin.landingLevel")}</label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-brand-grey-light bg-white text-sm"
            >
              <option>All Levels</option>
              <option>Beginner</option>
              <option>Intermediate</option>
              <option>Advanced</option>
              <option>Expert</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-brand-grey-dark mb-1">{t("admin.landingCategory")}</label>
          <Input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder={t("admin.landingCategoryPlaceholder")}
          />
        </div>
      </Card>
      <Card className="p-6 space-y-4">
        <div>
          <h3 className="font-semibold text-brand-grey-dark mb-1">{t("admin.landingPromoVideo")}</h3>
          <p className="text-sm text-brand-grey mb-2">{t("admin.landingPromoVideoHint")}</p>
          <Input
            value={promoVideoUrl}
            onChange={(e) => setPromoVideoUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
          />
          {promoVideoUrl && <UrlPreview url={promoVideoUrl} type="video" />}
        </div>
        <div>
          <h3 className="font-semibold text-brand-grey-dark mb-1">{t("admin.landingThumbnail")}</h3>
          <p className="text-sm text-brand-grey mb-2">{t("admin.landingThumbnailHint")}</p>
          <input
            ref={thumbFileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              void handleThumbFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={uploadingThumb}
            onClick={() => thumbFileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setThumbDragging(true);
            }}
            onDragLeave={() => setThumbDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setThumbDragging(false);
              void handleThumbFile(e.dataTransfer.files?.[0]);
            }}
            className={`w-full cursor-pointer rounded-lg border-2 border-dashed px-4 py-8 text-center text-sm transition-colors ${
              thumbDragging
                ? "border-brand-green bg-brand-green/5"
                : "border-brand-grey-light bg-white hover:border-brand-green/50"
            } ${uploadingThumb ? "pointer-events-none opacity-60" : ""}`}
          >
            {uploadingThumb ? t("common.loading") : t("admin.landingThumbnailDrop")}
          </button>
          <p className="mt-3 text-sm font-medium text-brand-grey-dark">{t("admin.landingThumbnailUrlOptional")}</p>
          <Input
            value={thumbnailUrl}
            onChange={(e) => setThumbnailUrl(e.target.value)}
            placeholder="https://..."
            className="mt-1"
          />
          {thumbPreviewSrc ? (
            <div className="mt-2 w-64 overflow-hidden rounded-lg border border-brand-grey-light">
              <img src={thumbPreviewSrc} alt="Thumbnail preview" className="h-auto w-full" />
            </div>
          ) : null}
        </div>
      </Card>
      <Button onClick={handleSave}>{t("common.save")}</Button>
    </div>
  );
}

/* ─── Subtitles Panel ─── */
function SubtitlesPanel({
  metadata,
  onSave,
}: {
  metadata: Record<string, unknown>;
  onSave: (val: unknown) => void;
}) {
  const { t } = useI18n();
  const saved = (metadata.subtitles ?? []) as { language: string; url: string }[];
  const [entries, setEntries] = useState(saved.length ? saved : [{ language: "", url: "" }]);

  const addEntry = () => setEntries((prev) => [...prev, { language: "", url: "" }]);
  const removeEntry = (idx: number) => setEntries((prev) => prev.filter((_, i) => i !== idx));
  const updateEntry = (idx: number, field: "language" | "url", value: string) =>
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e)));

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="font-semibold text-brand-grey-dark mb-1">{t("admin.subtitlesTitle")}</h3>
        <p className="text-sm text-brand-grey mb-4">{t("admin.subtitlesHint")}</p>
        <div className="space-y-3">
          {entries.map((entry, idx) => (
            <div key={idx} className="flex gap-3 items-start">
              <select
                value={entry.language}
                onChange={(e) => updateEntry(idx, "language", e.target.value)}
                className="w-40 px-3 py-2.5 rounded-lg border border-brand-grey-light bg-white text-sm"
              >
                <option value="">{t("admin.subtitlesSelectLang")}</option>
                <option value="English">English</option>
                <option value="French">French</option>
                <option value="Spanish">Spanish</option>
                <option value="German">German</option>
                <option value="Arabic">Arabic</option>
                <option value="Portuguese">Portuguese</option>
                <option value="Chinese">Chinese</option>
                <option value="Japanese">Japanese</option>
              </select>
              <Input
                value={entry.url}
                onChange={(e) => updateEntry(idx, "url", e.target.value)}
                placeholder={t("admin.subtitlesUrlPlaceholder")}
                className="flex-1"
              />
              {entries.length > 1 && (
                <Button variant="ghost" size="sm" className="text-red-600 shrink-0" onClick={() => removeEntry(idx)}>
                  ×
                </Button>
              )}
            </div>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={addEntry} className="mt-3">
          + {t("admin.subtitlesAddLanguage")}
        </Button>
      </Card>
      <Button onClick={() => onSave(entries.filter((e) => e.language && e.url))}>
        {t("common.save")}
      </Button>
    </div>
  );
}

/* ─── Accessibility Panel ─── */
function AccessibilityPanel({
  metadata,
  onSave,
}: {
  metadata: Record<string, unknown>;
  onSave: (val: unknown) => void;
}) {
  const { t } = useI18n();
  const saved = (metadata.accessibility ?? {}) as Record<string, boolean | string>;
  const [hasTranscripts, setHasTranscripts] = useState(!!saved.hasTranscripts);
  const [hasClosedCaptions, setHasClosedCaptions] = useState(!!saved.hasClosedCaptions);
  const [hasAudioDescription, setHasAudioDescription] = useState(!!saved.hasAudioDescription);
  const [notes, setNotes] = useState((saved.notes as string) ?? "");

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="font-semibold text-brand-grey-dark mb-1">{t("admin.accessibilityTitle")}</h3>
        <p className="text-sm text-brand-grey mb-4">{t("admin.accessibilityHint")}</p>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={hasTranscripts} onChange={(e) => setHasTranscripts(e.target.checked)} className="w-4 h-4 rounded border-brand-grey-light accent-brand-purple" />
            <span className="text-sm text-brand-grey-dark">{t("admin.accessibilityTranscripts")}</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={hasClosedCaptions} onChange={(e) => setHasClosedCaptions(e.target.checked)} className="w-4 h-4 rounded border-brand-grey-light accent-brand-purple" />
            <span className="text-sm text-brand-grey-dark">{t("admin.accessibilityCaptions")}</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={hasAudioDescription} onChange={(e) => setHasAudioDescription(e.target.checked)} className="w-4 h-4 rounded border-brand-grey-light accent-brand-purple" />
            <span className="text-sm text-brand-grey-dark">{t("admin.accessibilityAudioDesc")}</span>
          </label>
        </div>
      </Card>
      <Card className="p-6">
        <h3 className="font-semibold text-brand-grey-dark mb-1">{t("admin.accessibilityNotes")}</h3>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="w-full px-4 py-2.5 rounded-lg border border-brand-grey-light bg-white text-sm"
          placeholder={t("admin.accessibilityNotesPlaceholder")}
        />
      </Card>
      <Button
        onClick={() =>
          onSave({ hasTranscripts, hasClosedCaptions, hasAudioDescription, notes })
        }
      >
        {t("common.save")}
      </Button>
    </div>
  );
}

/* ─── Pricing Panel ─── */
function PricingPanel({
  metadata,
  onSave,
}: {
  metadata: Record<string, unknown>;
  onSave: (val: unknown) => void;
}) {
  const { t } = useI18n();
  const saved = (metadata.pricing ?? {}) as Record<string, unknown>;
  const [isFree, setIsFree] = useState(saved.isFree !== false);
  const [price, setPrice] = useState((saved.price as string) ?? "");
  const [currency, setCurrency] = useState((saved.currency as string) ?? "USD");

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="font-semibold text-brand-grey-dark mb-1">{t("admin.pricingTitle")}</h3>
        <p className="text-sm text-brand-grey mb-4">{t("admin.pricingHint")}</p>
        <div className="space-y-4">
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="pricing" checked={isFree} onChange={() => setIsFree(true)} className="accent-brand-purple" />
              <span className="text-sm font-medium text-brand-grey-dark">{t("admin.pricingFree")}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="pricing" checked={!isFree} onChange={() => setIsFree(false)} className="accent-brand-purple" />
              <span className="text-sm font-medium text-brand-grey-dark">{t("admin.pricingPaid")}</span>
            </label>
          </div>
          {!isFree && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-brand-grey-dark mb-1">{t("admin.pricingAmount")}</label>
                <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="29.99" />
              </div>
              <div className="w-32">
                <label className="block text-sm font-medium text-brand-grey-dark mb-1">{t("admin.pricingCurrency")}</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-brand-grey-light bg-white text-sm"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="CAD">CAD</option>
                  <option value="MAD">MAD</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </Card>
      <Button onClick={() => onSave({ isFree, price: isFree ? "0" : price, currency })}>
        {t("common.save")}
      </Button>
    </div>
  );
}

/* ─── Promotions Panel ─── */
function PromotionsPanel({
  metadata,
  onSave,
}: {
  metadata: Record<string, unknown>;
  onSave: (val: unknown) => void;
}) {
  const { t } = useI18n();
  type Coupon = { code: string; discountPct: string; expiresAt: string };
  const saved = (metadata.promotions ?? { coupons: [] }) as { coupons: Coupon[] };
  const [coupons, setCoupons] = useState<Coupon[]>(saved.coupons ?? []);

  const addCoupon = () => setCoupons((prev) => [...prev, { code: "", discountPct: "", expiresAt: "" }]);
  const removeCoupon = (idx: number) => setCoupons((prev) => prev.filter((_, i) => i !== idx));
  const updateCoupon = (idx: number, field: keyof Coupon, value: string) =>
    setCoupons((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="font-semibold text-brand-grey-dark mb-1">{t("admin.promotionsTitle")}</h3>
        <p className="text-sm text-brand-grey mb-4">{t("admin.promotionsHint")}</p>
        {coupons.length === 0 && (
          <p className="text-sm text-brand-grey italic mb-3">{t("admin.promotionsNoCoupons")}</p>
        )}
        <div className="space-y-3">
          {coupons.map((c, idx) => (
            <div key={idx} className="flex gap-3 items-start p-3 rounded-lg border border-brand-grey-light bg-brand-grey-light/10">
              <Input
                value={c.code}
                onChange={(e) => updateCoupon(idx, "code", e.target.value)}
                placeholder={t("admin.promotionsCouponCode")}
                className="flex-1"
              />
              <Input
                value={c.discountPct}
                onChange={(e) => updateCoupon(idx, "discountPct", e.target.value)}
                placeholder={t("admin.promotionsDiscount")}
                className="w-28"
              />
              <Input
                type="date"
                value={c.expiresAt}
                onChange={(e) => updateCoupon(idx, "expiresAt", e.target.value)}
                className="w-40"
              />
              <Button variant="ghost" size="sm" className="text-red-600 shrink-0" onClick={() => removeCoupon(idx)}>
                ×
              </Button>
            </div>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={addCoupon} className="mt-3">
          + {t("admin.promotionsAddCoupon")}
        </Button>
      </Card>
      <Button onClick={() => onSave({ coupons })}>
        {t("common.save")}
      </Button>
    </div>
  );
}

/* ─── Course Messages Panel ─── */
function MessagesPanel({
  metadata,
  onSave,
}: {
  metadata: Record<string, unknown>;
  onSave: (val: unknown) => void;
}) {
  const { t } = useI18n();
  const saved = (metadata.messages ?? {}) as Record<string, string>;
  const [welcomeMessage, setWelcomeMessage] = useState(saved.welcomeMessage ?? "");
  const [completionMessage, setCompletionMessage] = useState(saved.completionMessage ?? "");

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="font-semibold text-brand-grey-dark mb-1">{t("admin.messagesWelcome")}</h3>
        <p className="text-sm text-brand-grey mb-3">{t("admin.messagesWelcomeHint")}</p>
        <textarea
          value={welcomeMessage}
          onChange={(e) => setWelcomeMessage(e.target.value)}
          rows={4}
          className="w-full px-4 py-2.5 rounded-lg border border-brand-grey-light bg-white text-sm"
          placeholder={t("admin.messagesWelcomePlaceholder")}
        />
      </Card>
      <Card className="p-6">
        <h3 className="font-semibold text-brand-grey-dark mb-1">{t("admin.messagesCompletion")}</h3>
        <p className="text-sm text-brand-grey mb-3">{t("admin.messagesCompletionHint")}</p>
        <textarea
          value={completionMessage}
          onChange={(e) => setCompletionMessage(e.target.value)}
          rows={4}
          className="w-full px-4 py-2.5 rounded-lg border border-brand-grey-light bg-white text-sm"
          placeholder={t("admin.messagesCompletionPlaceholder")}
        />
      </Card>
      <Button onClick={() => onSave({ welcomeMessage, completionMessage })}>
        {t("common.save")}
      </Button>
    </div>
  );
}

/* ─── Availability Panel ─── */
function AvailabilityPanel({
  metadata,
  onSave,
}: {
  metadata: Record<string, unknown>;
  onSave: (val: unknown) => void;
}) {
  const { t } = useI18n();
  const saved = (metadata.availability ?? {}) as Record<string, unknown>;
  const [status, setStatus] = useState((saved.status as string) ?? "draft");
  const [enrollmentStart, setEnrollmentStart] = useState((saved.enrollmentStart as string) ?? "");
  const [enrollmentEnd, setEnrollmentEnd] = useState((saved.enrollmentEnd as string) ?? "");
  const [maxParticipants, setMaxParticipants] = useState((saved.maxParticipants as string) ?? "");

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="font-semibold text-brand-grey-dark mb-1">{t("admin.availabilityStatus")}</h3>
        <p className="text-sm text-brand-grey mb-3">{t("admin.availabilityStatusHint")}</p>
        <div className="flex gap-4">
          {(["draft", "published", "archived"] as const).map((s) => (
            <label key={s} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="status" checked={status === s} onChange={() => setStatus(s)} className="accent-brand-purple" />
              <span className="text-sm font-medium text-brand-grey-dark capitalize">{t(`admin.availability${s.charAt(0).toUpperCase() + s.slice(1)}` as keyof object) || s}</span>
            </label>
          ))}
        </div>
      </Card>
      <Card className="p-6 space-y-4">
        <h3 className="font-semibold text-brand-grey-dark mb-1">{t("admin.availabilityEnrollment")}</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-brand-grey-dark mb-1">{t("admin.availabilityStartDate")}</label>
            <Input type="date" value={enrollmentStart} onChange={(e) => setEnrollmentStart(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-grey-dark mb-1">{t("admin.availabilityEndDate")}</label>
            <Input type="date" value={enrollmentEnd} onChange={(e) => setEnrollmentEnd(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-brand-grey-dark mb-1">{t("admin.availabilityMaxParticipants")}</label>
          <Input
            value={maxParticipants}
            onChange={(e) => setMaxParticipants(e.target.value)}
            placeholder={t("admin.availabilityUnlimited")}
            className="w-48"
          />
        </div>
      </Card>
      <Button
        onClick={() =>
          onSave({ status, enrollmentStart, enrollmentEnd, maxParticipants })
        }
      >
        {t("common.save")}
      </Button>
    </div>
  );
}

/* ─── Participants Panel ─── */
type ParticipantRow = {
  userId: string;
  user?: { name?: string; email?: string };
  status?: string;
  progressPct?: number;
};

function ParticipantsPanel({ courseId }: { courseId: string }) {
  const { t } = useI18n();
  const params = useParams();
  const slug = typeof params.tenant === "string" ? params.tenant : "";
  const { tenant, branding } = useTenant();
  const academyName = branding?.appName || tenant?.name || "Academy";
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [loading, setLoading] = useState(true);

  const participantColumns: ColumnDef<ParticipantRow>[] = [
    {
      key: "name",
      header: t("admin.participantsName"),
      accessor: (p) => p.user?.name ?? p.userId,
    },
    {
      key: "email",
      header: t("admin.participantsEmail"),
      accessor: (p) => p.user?.email ?? "—",
    },
    {
      key: "status",
      header: t("admin.participantsStatus"),
      accessor: (p) =>
        p.status === "COMPLETED"
          ? t("admin.participantsCompleted") ?? "Completed"
          : t("admin.participantsActive") ?? "Active",
    },
    {
      key: "progress",
      header: t("admin.participantsProgress") ?? "Progress",
      accessor: (p) => `${p.progressPct ?? 0}%`,
    },
  ];

  useEffect(() => {
    apiFetch(`/course-enrollments/course/${courseId}`)
      .then((r) => r.json())
      .then((data) => {
        const enrollments = Array.isArray(data) ? data : [];
        setParticipants(
          enrollments.map((e: { userId: string; user?: { name?: string; email?: string }; status?: string; progressPct?: number }) => ({
            userId: e.userId,
            user: e.user,
            status: e.status,
            progressPct: e.progressPct,
          })),
        );
      })
      .catch(() => setParticipants([]))
      .finally(() => setLoading(false));
  }, [courseId]);

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="font-semibold text-brand-grey-dark mb-1">{t("admin.participantsTitle")}</h3>
        <p className="text-sm text-brand-grey mb-4">{t("admin.participantsHint")}</p>
        {loading ? (
          <p className="text-sm text-brand-grey">{t("common.loading")}</p>
        ) : participants.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-brand-grey text-sm">{t("admin.participantsNone")}</p>
          </div>
        ) : (
          <div className="border border-brand-grey-light rounded-lg overflow-hidden">
            <div className="flex justify-end mb-3">
              <ExportButtons<ParticipantRow>
                rows={participants}
                columns={participantColumns}
                tenantSlug={slug}
                filenameBase={`course-${courseId}-participants`}
                pdfTitle={`${t("admin.participantsTitle")} — ${academyName}`}
                academyLogoUrl={tenant?.logoUrl}
              />
            </div>
            <table className="w-full text-sm">
              <thead className="bg-brand-grey-light/30">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-brand-grey-dark">{t("admin.participantsName")}</th>
                  <th className="text-left px-4 py-2 font-medium text-brand-grey-dark">{t("admin.participantsEmail")}</th>
                  <th className="text-left px-4 py-2 font-medium text-brand-grey-dark">{t("admin.participantsStatus")}</th>
                  <th className="text-left px-4 py-2 font-medium text-brand-grey-dark">{t("admin.participantsProgress") ?? "Progress"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-grey-light">
                {participants.map((p) => (
                  <tr key={p.userId}>
                    <td className="px-4 py-2 text-brand-grey-dark">{p.user?.name ?? p.userId}</td>
                    <td className="px-4 py-2 text-brand-grey">{p.user?.email ?? "—"}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs border ${
                        p.status === "COMPLETED"
                          ? "bg-green-50 text-green-700 border-green-200"
                          : "bg-blue-50 text-blue-700 border-blue-200"
                      }`}>
                        {p.status === "COMPLETED" ? t("admin.participantsCompleted") ?? "Completed" : t("admin.participantsActive") ?? "Active"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-brand-grey-dark">{p.progressPct ?? 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
