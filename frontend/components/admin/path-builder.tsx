"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/context";

interface Step {
  id: string;
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
  onSave: () => void;
}

export function PathBuilder({ domains, tenantId, contentTypes, onSave }: PathBuilderProps) {
  const { t } = useI18n();
  const [pathName, setPathName] = useState(t("pathBuilder.newLearningPath"));
  const [pathDomainId, setPathDomainId] = useState(domains[0]?.id ?? "");
  const [pathDescription, setPathDescription] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);

  const addStep = (type: string) => {
    const defaultDuration =
      type === "COURSE" ? "4 hours" : type === "MICRO_LEARNING" ? "5 min" : "15 min";
    setSteps((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        title: `New ${type.replace("_", " ")}`,
        type,
        duration: defaultDuration,
        required: false,
        order: prev.length + 1,
      },
    ]);
  };

  const removeStep = (id: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i + 1 })));
  };

  const updateStep = (id: string, updates: Partial<Step>) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
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
          <div className="grid grid-cols-2 gap-2">
            {contentTypes.map((ct) => (
              <button
                key={ct.type}
                onClick={() => addStep(ct.type)}
                className="flex flex-col items-center gap-1 p-3 rounded-lg border border-brand-grey-light hover:border-brand-purple hover:bg-brand-purple/5 transition-colors"
              >
                <span className="text-xl">{ct.icon}</span>
                <span className="text-xs text-brand-grey-dark font-medium text-center">
                  {ct.type.replace("_", " ")}
                </span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="lg:col-span-2 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-brand-grey-dark">
            {t("pathBuilder.stepsCount", { name: pathName, count: steps.length })}
          </h3>
          <Button onClick={onSave}>{t("pathBuilder.savePath")}</Button>
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
                <div className="flex-1">
                  <Input
                    value={step.title}
                    onChange={(e) => updateStep(step.id, { title: e.target.value })}
                    className="border-0 p-0 font-semibold"
                  />
                  <span className="text-xs text-brand-grey">
                    {step.type.replace("_", " ")} · {step.duration}
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
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
