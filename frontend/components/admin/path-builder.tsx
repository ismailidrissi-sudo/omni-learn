"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/context";
import { apiFetch } from "@/lib/api";

interface ContentItem {
  id: string;
  title: string;
  type: string;
  durationMinutes?: number;
  domainId?: string;
}

interface Step {
  id: string;
  contentItemId: string;
  title: string;
  type: string;
  duration: string;
  durationMinutes: number;
  required: boolean;
  order: number;
}

interface PathBuilderProps {
  domains: Array<{ id: string; name: string; icon: string }>;
  tenantId?: string | null;
  contentTypes: Array<{ type: string; icon: string }>;
  onSave: (pathId: string) => void;
  editingPath?: {
    id: string;
    name: string;
    domainId: string;
    description?: string;
    isPublished?: boolean;
    steps?: Array<{
      id: string;
      contentItemId: string;
      contentItem?: { id: string; title: string; type: string; durationMinutes?: number };
      stepOrder: number;
      isRequired: boolean;
    }>;
  } | null;
}

function formatDuration(minutes?: number): string {
  if (!minutes) return "\u2014";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function PathBuilder({ domains, tenantId, contentTypes, onSave, editingPath }: PathBuilderProps) {
  const { t } = useI18n();
  const [pathName, setPathName] = useState(editingPath?.name ?? t("pathBuilder.newLearningPath"));
  const [pathDomainId, setPathDomainId] = useState(editingPath?.domainId ?? domains[0]?.id ?? "");
  const [pathDescription, setPathDescription] = useState(editingPath?.description ?? "");
  const [steps, setSteps] = useState<Step[]>(() => {
    if (!editingPath?.steps) return [];
    return editingPath.steps.map((s) => ({
      id: s.id,
      contentItemId: s.contentItemId,
      title: s.contentItem?.title ?? "Untitled",
      type: s.contentItem?.type ?? "COURSE",
      duration: formatDuration(s.contentItem?.durationMinutes),
      durationMinutes: s.contentItem?.durationMinutes ?? 0,
      required: s.isRequired,
      order: s.stepOrder,
    }));
  });
  const [saving, setSaving] = useState(false);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [contentSearch, setContentSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");

  useEffect(() => {
    apiFetch("/content?admin=true")
      .then((r) => r.json())
      .then((data: ContentItem[]) => setContentItems(Array.isArray(data) ? data : []))
      .catch(() => setContentItems([]));
  }, []);

  const filteredContent = useMemo(() => {
    const usedIds = new Set(steps.map((s) => s.contentItemId));
    return contentItems.filter((item) => {
      if (usedIds.has(item.id)) return false;
      if (filterType !== "ALL" && item.type !== filterType) return false;
      if (contentSearch && !item.title.toLowerCase().includes(contentSearch.toLowerCase())) return false;
      return true;
    });
  }, [contentItems, steps, filterType, contentSearch]);

  const stats = useMemo(() => {
    const totalMinutes = steps.reduce((sum, s) => sum + s.durationMinutes, 0);
    const requiredCount = steps.filter((s) => s.required).length;
    return { totalMinutes, requiredCount, totalSteps: steps.length };
  }, [steps]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const usedIds = new Set(steps.map((s) => s.contentItemId));
    for (const item of contentItems) {
      if (!usedIds.has(item.id)) {
        counts[item.type] = (counts[item.type] ?? 0) + 1;
      }
    }
    return counts;
  }, [contentItems, steps]);

  const addContentAsStep = (item: ContentItem) => {
    setSteps((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        contentItemId: item.id,
        title: item.title,
        type: item.type,
        duration: formatDuration(item.durationMinutes),
        durationMinutes: item.durationMinutes ?? 0,
        required: true,
        order: prev.length + 1,
      },
    ]);
  };

  const removeStep = (id: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i + 1 })));
  };

  const moveStep = (index: number, direction: "up" | "down") => {
    const newSteps = [...steps];
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= steps.length) return;
    [newSteps[index], newSteps[target]] = [newSteps[target], newSteps[index]];
    setSteps(newSteps.map((s, i) => ({ ...s, order: i + 1 })));
  };

  const toggleRequired = (id: string) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, required: !s.required } : s))
    );
  };

  const handleSave = async () => {
    if (!pathName.trim() || !pathDomainId) return;
    setSaving(true);
    try {
      const slug = pathName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      let pathId: string;

      if (editingPath?.id) {
        const res = await apiFetch(`/learning-paths/${editingPath.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: pathName.trim(),
            domainId: pathDomainId,
            slug,
            description: pathDescription,
          }),
        });
        if (!res.ok) throw new Error("Failed to update path");
        pathId = editingPath.id;
      } else {
        const res = await apiFetch("/learning-paths", {
          method: "POST",
          body: JSON.stringify({
            tenantId: tenantId ?? undefined,
            domainId: pathDomainId,
            name: pathName.trim(),
            slug,
            description: pathDescription,
          }),
        });
        if (!res.ok) throw new Error("Failed to create path");
        const created = await res.json();
        pathId = created.id;
      }

      for (let i = 0; i < steps.length; i++) {
        await apiFetch(`/learning-paths/${pathId}/steps`, {
          method: "POST",
          body: JSON.stringify({
            contentItemId: steps[i].contentItemId,
            stepOrder: i + 1,
            isRequired: steps[i].required,
          }),
        });
      }

      onSave(pathId);
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-brand-purple/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-brand-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-[var(--color-text-primary)] truncate">
              {pathName || "Untitled Path"}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {editingPath ? "Editing path" : "New path"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-lg font-bold text-[var(--color-text-primary)]">{stats.totalSteps}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Steps</p>
          </div>
          <div className="w-px h-8 bg-gray-200 dark:bg-white/10" />
          <div className="text-center">
            <p className="text-lg font-bold text-[var(--color-text-primary)]">{formatDuration(stats.totalMinutes)}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Duration</p>
          </div>
          <div className="w-px h-8 bg-gray-200 dark:bg-white/10" />
          <div className="text-center">
            <p className="text-lg font-bold text-brand-purple">{stats.requiredCount}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Required</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving || !pathName.trim() || !pathDomainId} className="gap-1.5">
          {saving ? (
            <>
              <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Saving...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              {t("pathBuilder.savePath")}
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left panel: config + content library */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="p-5">
            <h3 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wider mb-4">
              {t("pathBuilder.pathConfig")}
            </h3>
            <div className="space-y-4">
              <Input
                label={t("admin.name")}
                value={pathName}
                onChange={(e) => setPathName(e.target.value)}
                placeholder={t("pathBuilder.pathName")}
              />
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                  {t("pathBuilder.domain")}
                </label>
                <select
                  value={pathDomainId}
                  onChange={(e) => setPathDomainId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-white/15 bg-white dark:bg-white/5 text-[var(--color-text-primary)] focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple transition-colors"
                >
                  {domains.map((d) => (
                    <option key={d.id || d.name} value={d.id}>
                      {d.icon} {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                  {t("pathBuilder.descriptionLabel")}
                </label>
                <textarea
                  className="form-input min-h-[80px] resize-y"
                  value={pathDescription}
                  onChange={(e) => setPathDescription(e.target.value)}
                  placeholder={t("pathBuilder.description")}
                />
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wider mb-4">
              {t("pathBuilder.addStep")}
            </h3>
            <div className="flex gap-1.5 mb-3 flex-wrap">
              <button
                onClick={() => setFilterType("ALL")}
                className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border transition-all ${
                  filterType === "ALL"
                    ? "bg-brand-purple text-white border-brand-purple shadow-sm"
                    : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-brand-purple/50"
                }`}
              >
                All
                <Badge variant="default" className="ml-0.5 !text-[10px] !px-1.5 !py-0">
                  {contentItems.length - steps.length}
                </Badge>
              </button>
              {contentTypes.map((ct) => {
                const count = typeCounts[ct.type] ?? 0;
                return (
                  <button
                    key={ct.type}
                    onClick={() => setFilterType(ct.type)}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border transition-all ${
                      filterType === ct.type
                        ? "bg-brand-purple text-white border-brand-purple shadow-sm"
                        : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-brand-purple/50"
                    }`}
                  >
                    {ct.icon} {ct.type.replace(/_/g, " ")}
                    {count > 0 && (
                      <span className={`ml-0.5 text-[10px] font-bold ${filterType === ct.type ? "text-white/70" : "text-gray-400"}`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="relative mb-3">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <Input
                placeholder="Search content..."
                value={contentSearch}
                onChange={(e) => setContentSearch(e.target.value)}
                className="!pl-9"
              />
            </div>
            <div className="max-h-80 overflow-y-auto -mx-1 px-1 space-y-1">
              {filteredContent.length === 0 && (
                <div className="py-8 text-center">
                  <svg className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="text-sm text-gray-400 dark:text-gray-500">No content available</p>
                </div>
              )}
              {filteredContent.map((item) => {
                const ct = contentTypes.find((c) => c.type === item.type);
                return (
                  <button
                    key={item.id}
                    onClick={() => addContentAsStep(item)}
                    className="w-full text-left flex items-center gap-3 p-3 rounded-xl hover:bg-brand-purple/5 dark:hover:bg-brand-purple/10 border border-transparent hover:border-brand-purple/20 transition-all group"
                  >
                    <span className="text-xl flex-shrink-0">{ct?.icon ?? "📄"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text-primary)] truncate group-hover:text-brand-purple transition-colors">
                        {item.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {item.type.replace(/_/g, " ")} · {formatDuration(item.durationMinutes)}
                      </p>
                    </div>
                    <div className="w-7 h-7 rounded-full bg-brand-purple/10 dark:bg-brand-purple/20 flex items-center justify-center flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="w-4 h-4 text-brand-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right panel: steps timeline */}
        <div className="lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wider">
              {t("pathBuilder.stepsCount", { name: pathName, count: steps.length })}
            </h3>
          </div>

          {steps.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-brand-purple/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-brand-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <p className="text-[var(--color-text-primary)] font-medium mb-1">{t("pathBuilder.noStepsYet")}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Select content items from the left panel to add steps</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {steps.map((step, index) => {
                const ct = contentTypes.find((c) => c.type === step.type);
                const isFirst = index === 0;
                const isLast = index === steps.length - 1;
                return (
                  <Card
                    key={step.id}
                    className="p-4 flex items-center gap-4 group hover:shadow-md hover:shadow-brand-purple/5 transition-all"
                  >
                    {/* Step number & reorder */}
                    <div className="flex flex-col items-center gap-0.5 w-8 flex-shrink-0">
                      <button
                        onClick={() => moveStep(index, "up")}
                        disabled={isFirst}
                        className={`p-0.5 rounded transition-colors ${isFirst ? "text-gray-200 dark:text-gray-700 cursor-default" : "text-gray-400 hover:text-brand-purple hover:bg-brand-purple/5"}`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                      </button>
                      <span className="w-7 h-7 rounded-full bg-brand-purple/10 text-brand-purple text-xs font-bold flex items-center justify-center">
                        {index + 1}
                      </span>
                      <button
                        onClick={() => moveStep(index, "down")}
                        disabled={isLast}
                        className={`p-0.5 rounded transition-colors ${isLast ? "text-gray-200 dark:text-gray-700 cursor-default" : "text-gray-400 hover:text-brand-purple hover:bg-brand-purple/5"}`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </button>
                    </div>

                    {/* Icon */}
                    <div className="w-10 h-10 rounded-lg bg-gray-50 dark:bg-white/5 flex items-center justify-center flex-shrink-0 text-xl">
                      {ct?.icon ?? "📄"}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[var(--color-text-primary)] truncate">{step.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {step.type.replace(/_/g, " ")}
                        </span>
                        <span className="text-gray-300 dark:text-gray-600">&middot;</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          {step.duration}
                        </span>
                      </div>
                    </div>

                    {/* Required toggle */}
                    <button
                      onClick={() => toggleRequired(step.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                        step.required
                          ? "bg-brand-purple/10 text-brand-purple border-brand-purple/20"
                          : "bg-gray-50 dark:bg-white/5 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-white/10 hover:border-brand-purple/30"
                      }`}
                    >
                      {step.required ? t("common.required") : t("common.optional")}
                    </button>

                    {/* Remove */}
                    <button
                      onClick={() => removeStep(step.id)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                      title="Remove step"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
