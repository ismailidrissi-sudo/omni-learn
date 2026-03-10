"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/context";

/**
 * Implementation Guide Wizard — Step-by-step wizard
 * omnilearn.space | Phase 3
 */

interface WizardStep {
  id: string;
  title: string;
  content: string;
  checklist?: string[];
  templateUrl?: string;
}

interface ImplementationGuideWizardProps {
  title: string;
  steps: WizardStep[];
  onComplete?: () => void;
}

export function ImplementationGuideWizard({
  title,
  steps,
  onComplete,
}: ImplementationGuideWizardProps) {
  const { t } = useI18n();
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const step = steps[currentStep];

  const markComplete = () => {
    setCompletedSteps((prev) => new Set([...prev, currentStep]));
    if (currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      onComplete?.();
    }
  };

  if (!step) return null;

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-brand-subheading font-bold text-brand-grey-dark mb-6">
        {title}
      </h2>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {steps.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setCurrentStep(i)}
            className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
              i === currentStep
                ? "bg-brand-purple text-white"
                : completedSteps.has(i)
                ? "bg-brand-purple/30 text-brand-purple"
                : "bg-brand-grey-light text-brand-grey"
            }`}
          >
            {completedSteps.has(i) ? "✓" : i + 1}
          </button>
        ))}
      </div>

      <Card className="p-6">
        <h3 className="font-semibold text-brand-grey-dark mb-4">
          {t("learn.step")} {currentStep + 1}: {step.title}
        </h3>
        <p className="text-brand-paragraph text-brand-grey-dark mb-4 whitespace-pre-wrap">
          {step.content}
        </p>
        {step.checklist && step.checklist.length > 0 && (
          <ul className="list-disc list-inside space-y-2 mb-4 text-brand-grey-dark">
            {step.checklist.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        )}
        {step.templateUrl && (
          <a
            href={step.templateUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-purple font-medium text-sm hover:underline"
          >
            {t("learn.downloadTemplate")}
          </a>
        )}
        <div className="mt-6 flex gap-2">
          {currentStep > 0 && (
            <Button
              variant="outline"
              onClick={() => setCurrentStep((s) => s - 1)}
            >
              {t("common.previous")}
            </Button>
          )}
          <Button onClick={markComplete}>
            {currentStep < steps.length - 1 ? t("common.next") : t("common.complete")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
