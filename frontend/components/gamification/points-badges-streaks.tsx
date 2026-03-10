"use client";

import { useI18n } from "@/lib/i18n/context";

/**
 * Points, Badges, Streaks — Gamification display
 * omnilearn.space | Phase 3
 */

interface Badge {
  id: string;
  name: string;
  icon: string;
  earnedAt: string;
}

interface PointsBadgesStreaksProps {
  points: number;
  badges: Badge[];
  currentStreak: number;
  longestStreak: number;
}

export function PointsBadgesStreaks({
  points,
  badges,
  currentStreak,
  longestStreak,
}: PointsBadgesStreaksProps) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap gap-4">
      <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-purple/10 border border-brand-purple/20">
        <span className="text-2xl">⭐</span>
        <div>
          <p className="text-xs text-brand-grey">{t("gamification.points")}</p>
          <p className="font-bold text-brand-purple">{points}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-purple/10 border border-brand-purple/20">
        <span className="text-2xl">🔥</span>
        <div>
          <p className="text-xs text-brand-grey">{t("gamification.streak")}</p>
          <p className="font-bold text-brand-purple">
            {t("gamification.streakBest", { current: currentStreak, longest: longestStreak })}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-purple/10 border border-brand-purple/20">
        <span className="text-2xl">🏆</span>
        <div>
          <p className="text-xs text-brand-grey">{t("gamification.badges")}</p>
          <p className="font-bold text-brand-purple">{badges.length}</p>
        </div>
      </div>
      {badges.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {badges.map((b) => (
            <div
              key={b.id}
              className="flex items-center gap-1 px-2 py-1 rounded bg-brand-grey-light"
              title={b.name}
            >
              <span>{b.icon}</span>
              <span className="text-xs font-medium text-brand-grey-dark">
                {b.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
