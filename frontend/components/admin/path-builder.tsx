"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
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
  if (!minutes) return "—";
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

  const addContentAsStep = (item: ContentItem) => {
    setSteps((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        contentItemId: item.id,
        title: item.title,
        type: item.type,
        duration: formatDuration(item.durationMinutes),
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 space-y-4">
        <Card className="p-4">
          <h3 className="font-semibold text-brand-grey-dark mb-3">{t("pathBuilder.pathConfig")}</h3>
          <Input
            label={t("admin.name")}
            value={pathName}
            onChange={(e) => setPathName(e.target.value)}
            placeholder={t("pathBuilder.pathName")}
          />
          <div className="mt-3">
            <label className="block text-sm font-medium text-brand-grey-dark mb-1">
              {t("pathBuilder.domain")}
            </label>
            <select
              value={pathDomainId}
              onChange={(e) => setPathDomainId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-brand-grey-light bg-white"
            >
              {domains.map((d) => (
                <option key={d.id || d.name} value={d.id}>
                  {d.icon} {d.name}
                </option>
              ))}
            </select>
          </div>
          <Input
            label={t("pathBuilder.descriptionLabel")}
            value={pathDescription}
            onChange={(e) => setPathDescription(e.target.value)}
            placeholder={t("pathBuilder.description")}
            className="mt-3"
          />
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold text-brand-grey-dark mb-3">{t("pathBuilder.addStep")}</h3>
          <div className="flex gap-2 mb-3 flex-wrap">
            <button
              onClick={() => setFilterType("ALL")}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                filterType === "ALL"
                  ? "bg-brand-purple text-white border-brand-purple"
                  : "border-brand-grey-light text-brand-grey-dark hover:border-brand-purple"
              }`}
            >
              All
            </button>
            {contentTypes.map((ct) => (
              <button
                key={ct.type}
                onClick={() => setFilterType(ct.type)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  filterType === ct.type
                    ? "bg-brand-purple text-white border-brand-purple"
                    : "border-brand-grey-light text-brand-grey-dark hover:border-brand-purple"
                }`}
              >
                {ct.icon} {ct.type.replace(/_/g, " ")}
              </button>
            ))}
          </div>
          <Input
            placeholder="Search content..."
            value={contentSearch}
            onChange={(e) => setContentSearch(e.target.value)}
            className="mb-3"
          />
          <div className="max-h-72 overflow-y-auto space-y-1">
            {filteredContent.length === 0 && (
              <p className="text-sm text-brand-grey py-4 text-center">No content available</p>
            )}
            {filteredContent.map((item) => {
              const ct = contentTypes.find((c) => c.type === item.type);
              return (
                <button
                  key={item.id}
                  onClick={() => addContentAsStep(item)}
                  className="w-full text-left flex items-center gap-2 p-2 rounded-lg hover:bg-brand-purple/5 border border-transparent hover:border-brand-purple/20 transition-colors"
                >
                  <span className="text-lg">{ct?.icon ?? "📄"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-brand-grey-dark truncate">{item.title}</p>
                    <p className="text-xs text-brand-grey">
                      {item.type.replace(/_/g, " ")} · {formatDuration(item.durationMinutes)}
                    </p>
                  </div>
                  <span className="text-brand-purple text-lg flex-shrink-0">+</span>
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="lg:col-span-2 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-brand-grey-dark">
            {t("pathBuilder.stepsCount", { name: pathName, count: steps.length })}
          </h3>
          <Button onClick={handleSave} disabled={saving || !pathName.trim() || !pathDomainId}>
            {saving ? "Saving..." : t("pathBuilder.savePath")}
          </Button>
        </div>

        <div className="space-y-2">
          {steps.map((step, index) => {
            const ct = contentTypes.find((c) => c.type === step.type);
            return (
              <Card key={step.id} className="p-4 flex items-center gap-4">
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => moveStep(index, "up")}
                    className="text-brand-grey hover:text-brand-purple text-xs"
                  >
                    ▲
                  </button>
                  <span className="text-brand-grey font-bold text-sm">
                    {index + 1}
                  </span>
                  <button
                    onClick={() => moveStep(index, "down")}
                    className="text-brand-grey hover:text-brand-purple text-xs"
                  >
                    ▼
                  </button>
                </div>
                <span className="text-2xl">{ct?.icon ?? "📄"}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-brand-grey-dark truncate">{step.title}</p>
                  <span className="text-xs text-brand-grey">
                    {step.type.replace(/_/g, " ")} · {step.duration}
                  </span>
                </div>
                <Button
                  variant={step.required ? "primary" : "ghost"}
                  size="sm"
                  onClick={() => toggleRequired(step.id)}
                >
                  {step.required ? t("common.required") : t("common.optional")}
                </Button>
                <button
                  onClick={() => removeStep(step.id)}
                  className="text-brand-grey hover:text-brand-grey-dark text-lg"
                >
                  ×
                </button>
              </Card>
            );
          })}
          {steps.length === 0 && (
            <Card className="p-8 text-center text-brand-grey">
              <p>{t("pathBuilder.noStepsYet")}</p>
              <p className="text-sm mt-1">Select content items from the left panel to add steps</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
