"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/context";
import { UrlPreview } from "@/components/admin/url-preview";
import { detectProvider, isExternalProvider, getProviderLabel } from "@/lib/video-provider";
import { apiFetch } from "@/lib/api";
import { toast } from "@/lib/use-toast";

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

interface CourseBuilderProps {
  courseId: string;
  courseTitle: string;
  onBack: () => void;
}

function getPreviewEnabled(item: CourseSectionItem): boolean {
  const meta = item.metadata as Record<string, unknown> | undefined;
  return meta?.previewEnabled === true;
}

export function CourseBuilder({ courseId, courseTitle, onBack }: CourseBuilderProps) {
  const { t } = useI18n();
  const [sections, setSections] = useState<CourseSection[]>([]);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<{ sectionId: string; itemId: string } | null>(null);
  const [itemDropdownOpen, setItemDropdownOpen] = useState<string | null>(null);

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

  useEffect(() => {
    loadCurriculum();
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

    const metadata: Record<string, unknown> = {};
    if (newItemType === "QUIZ" && newItemQuestions.length > 0) {
      metadata.questions = newItemQuestions.map((q) => ({
        id: q.id,
        question: q.question,
        options: q.options,
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

  const addQuizQuestion = () => {
    setNewItemQuestions((prev) => [
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
    setNewItemQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, ...updates } : q))
    );
  };

  const removeQuizQuestion = (idx: number) => {
    setNewItemQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const totalItems = sections.reduce((acc, s) => acc + s.items.length, 0);
  const totalDuration = sections.reduce(
    (acc, s) =>
      acc +
      s.items.reduce((a, i) => a + (i.durationMinutes ?? 0), 0),
    0
  );

  const sidebarNav = [
    { key: "curriculum", label: t("admin.curriculumTitle"), active: true },
    { key: "targets", label: t("admin.curriculumTargetParticipants"), active: false },
    { key: "landing", label: t("admin.curriculumLandingPage"), active: false },
    { key: "subtitles", label: t("admin.curriculumSubtitles"), active: false },
    { key: "accessibility", label: t("admin.curriculumAccessibility"), active: false },
  ];
  const managementNav = [
    { key: "pricing", label: t("admin.curriculumPricing"), active: false },
    { key: "promotions", label: t("admin.curriculumPromotions"), active: false },
    { key: "messages", label: t("admin.curriculumMessages"), active: false },
    { key: "availability", label: t("admin.curriculumAvailability"), active: false },
    { key: "participants", label: t("admin.curriculumParticipants"), active: false },
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
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    item.active
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
                  className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-brand-grey-dark hover:bg-brand-grey-light/50 transition-colors"
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
                {t("admin.curriculumTitle")}
              </h1>
              <p className="text-sm text-brand-grey mt-1">
                {courseTitle} · {sections.length} {t("admin.courseSections")} · {totalItems} {t("admin.curriculumSession")}s · {totalDuration} min
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-brand-grey"
                onClick={() => toast("Bulk upload coming soon", "info")}
              >
                {t("admin.curriculumBulkUpload")}
              </Button>
              <Button variant="ghost" size="sm" onClick={onBack}>
                {t("common.back")}
              </Button>
            </div>
          </div>

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
                className="border border-brand-grey-light rounded-lg overflow-hidden bg-white"
              >
                {/* Section header */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-brand-grey-light/20 transition-colors"
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
                  <div className="border-t border-brand-grey-light bg-brand-grey-light/10">
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
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-medium text-brand-grey-dark">
                        {t("admin.courseQuizQuestions")}
                      </label>
                      <Button variant="ghost" size="sm" onClick={addQuizQuestion}>
                        + {t("admin.courseAddQuestion")}
                      </Button>
                    </div>
                    <div className="space-y-4">
                      {newItemQuestions.map((q, idx) => (
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
                              className="text-red-600"
                              onClick={() => removeQuizQuestion(idx)}
                            >
                              ×
                            </Button>
                          </div>
                          <Input
                            placeholder={t("admin.courseQuestionPlaceholder")}
                            value={q.question}
                            onChange={(e) =>
                              updateQuizQuestion(idx, { question: e.target.value })
                            }
                            className="mb-2"
                          />
                          <div className="space-y-2">
                            {q.options.map((opt, oi) => (
                              <div key={oi} className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={`correct-${q.id}`}
                                  checked={q.correctIndex === oi}
                                  onChange={() =>
                                    updateQuizQuestion(idx, { correctIndex: oi })
                                  }
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
  const [title, setTitle] = useState(item.title);
  const [url, setUrl] = useState(item.contentUrl ?? "");
  const [duration, setDuration] = useState(item.durationMinutes?.toString() ?? "");

  return (
    <div className="space-y-2">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
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
              placeholder="Duration (min)"
            />
          )}
        </>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() =>
            onSave({
              title,
              contentUrl: url || undefined,
              durationMinutes: duration ? parseInt(duration, 10) : undefined,
            })
          }
        >
          Save
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
