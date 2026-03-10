"use client";

import { useI18n } from "@/lib/i18n/context";

/**
 * Path Progress — Enrollment + step progress display
 * omnilearn.space | Phase 3
 */

interface Step {
  id: string;
  title: string;
  type: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  isRequired?: boolean;
  contentItem?: { title: string; type: string };
}

interface PathProgressProps {
  pathName: string;
  progressPct: number;
  steps: Step[];
  onStepClick?: (stepId: string) => void;
}

const STATUS_COLORS = {
  NOT_STARTED: "bg-brand-grey-light",
  IN_PROGRESS: "bg-brand-purple/30 border-brand-purple",
  COMPLETED: "bg-brand-purple text-white",
};

export function PathProgress({
  pathName,
  progressPct,
  steps,
  onStepClick,
}: PathProgressProps) {
  const { t } = useI18n();
  return (
    <div className="rounded-lg border border-brand-grey-light bg-white p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold text-brand-grey-dark">{pathName}</h2>
        <span className="text-brand-purple font-bold">{progressPct}%</span>
      </div>
      <div className="h-2 bg-brand-grey-light rounded-full overflow-hidden mb-6">
        <div
          className="h-full bg-brand-purple transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <div className="space-y-2">
        {steps.map((step, i) => (
          <button
            key={step.id}
            onClick={() => onStepClick?.(step.id)}
            className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${STATUS_COLORS[step.status]}`}
          >
            <span
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step.status === "COMPLETED"
                  ? "bg-white/20"
                  : step.status === "IN_PROGRESS"
                  ? "bg-brand-purple/20"
                  : "bg-brand-grey-light text-brand-grey"
              }`}
            >
              {step.status === "COMPLETED" ? "✓" : i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-brand-grey-dark truncate">
                {step.contentItem?.title ?? step.title}
              </p>
              <p className="text-xs text-brand-grey">
                {step.contentItem?.type ?? step.type} {step.isRequired && `· ${t("pathProgress.required")}`}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
