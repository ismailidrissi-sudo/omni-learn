"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/context";

/**
 * Interactive Quiz — Multiple choice / assessment
 * omnilearn.space | Phase 3
 */

interface QuizQuestion {
  id: string;
  question: string;
  options: Array<{ id: string; text: string; correct: boolean }>;
}

interface QuizProps {
  title: string;
  questions: QuizQuestion[];
  passingScore?: number;
  onComplete?: (score: number, passed: boolean) => void;
}

export function Quiz({
  title,
  questions,
  passingScore = 70,
  onComplete,
}: QuizProps) {
  const { t } = useI18n();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const [finished, setFinished] = useState(false);

  const question = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;

  const submitAnswer = () => {
    if (!selected || !question) return;
    const option = question.options.find((o) => o.id === selected);
    const correct = option?.correct ?? false;
    const newResults = [...results, correct];

    if (isLast) {
      setResults(newResults);
      setFinished(true);
      const score = Math.round((newResults.filter(Boolean).length / questions.length) * 100);
      onComplete?.(score, score >= passingScore);
    } else {
      setResults(newResults);
      setCurrentIndex((i) => i + 1);
      setSelected(null);
    }
  };

  if (finished) {
    const score = Math.round((results.filter(Boolean).length / questions.length) * 100);
    const passed = score >= passingScore;
    return (
      <Card className="p-8 text-center">
        <h2 className="text-brand-subheading font-bold text-brand-grey-dark mb-2">
          {title} — Complete
        </h2>
        <p className="text-4xl font-bold text-brand-purple mb-2">{score}%</p>
        <p className={passed ? "text-brand-purple" : "text-brand-grey-dark"}>
          {passed ? t("learn.passed") : t("learn.minPassing", { score: passingScore })}
        </p>
      </Card>
    );
  }

  if (!question) return null;

  return (
    <Card className="p-6">
      <h2 className="font-semibold text-brand-grey-dark mb-2">
        {t("learn.questionOf", { current: currentIndex + 1, total: questions.length })}
      </h2>
      <p className="text-brand-paragraph text-brand-grey-dark mb-4">
        {question.question}
      </p>
      <div className="space-y-2">
        {question.options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setSelected(opt.id)}
            className={`w-full text-left p-3 rounded-lg border transition-colors ${
              selected === opt.id
                ? "border-brand-purple bg-brand-purple/10"
                : "border-brand-grey-light hover:border-brand-grey"
            }`}
          >
            {opt.text}
          </button>
        ))}
      </div>
      <Button
        className="mt-4"
        onClick={submitAnswer}
        disabled={!selected}
      >
        {isLast ? t("common.submit") : t("common.next")}
      </Button>
    </Card>
  );
}
