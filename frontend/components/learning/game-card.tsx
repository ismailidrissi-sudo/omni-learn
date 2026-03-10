"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/context";

/**
 * Game Card — Simple interactive game placeholder
 * omnilearn.space | Phase 3 | Extend for specific game types
 */

interface GameCardProps {
  title: string;
  description?: string;
  type?: "scenario" | "matching" | "drag-drop" | "simulation";
  onComplete?: (score: number) => void;
}

export function GameCard({
  title,
  description,
  type = "scenario",
  onComplete,
}: GameCardProps) {
  const { t } = useI18n();
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<"intro" | "play" | "done">("intro");

  const handleChoice = (points: number) => {
    setScore((s) => s + points);
    setPhase("done");
    onComplete?.(score + points);
  };

  if (phase === "intro") {
    return (
      <Card className="p-6">
        <h2 className="font-semibold text-brand-grey-dark mb-2">{title}</h2>
        {description && (
          <p className="text-brand-paragraph text-brand-grey mb-4">
            {description}
          </p>
        )}
        <p className="text-sm text-brand-grey mb-4">
          {t("learn.gameType")}: {type.replace("-", " ")}
        </p>
        <Button onClick={() => setPhase("play")}>{t("learn.startGame")}</Button>
      </Card>
    );
  }

  if (phase === "play") {
    return (
      <Card className="p-6">
        <h2 className="font-semibold text-brand-grey-dark mb-4">{title}</h2>
        <p className="text-brand-grey mb-4">
          {t("learn.scenario")}
        </p>
        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => handleChoice(10)}
          >
            {t("learn.optionA")}
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => handleChoice(5)}
          >
            {t("learn.optionB")}
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => handleChoice(0)}
          >
            {t("learn.optionC")}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 text-center">
      <h2 className="font-semibold text-brand-grey-dark mb-2">{t("learn.complete")}</h2>
      <p className="text-3xl font-bold text-brand-purple mb-2">{score} {t("learn.points")}</p>
      <Button variant="outline" onClick={() => setPhase("intro")}>
        {t("learn.playAgain")}
      </Button>
    </Card>
  );
}
