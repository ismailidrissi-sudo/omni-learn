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
  level: number;
  pointsToNext: number;
  progressToNextPct: number;
}

export function PointsBadgesStreaks({
  points,
  badges,
  currentStreak,
  longestStreak,
  level,
  pointsToNext,
  progressToNextPct,
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
      <div className="min-w-[220px] px-4 py-2 rounded-lg bg-brand-purple/10 border border-brand-purple/20">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🚀</span>
          <div className="min-w-0">
            <p className="text-xs text-brand-grey">{t("gamification.level")}</p>
            <p className="font-bold text-brand-purple">Lv.{level}</p>
          </div>
        </div>
        <div className="mt-2">
          <div className="h-1.5 bg-brand-purple/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-purple rounded-full transition-all"
              style={{ width: `${Math.max(0, Math.min(100, progressToNextPct))}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-brand-grey">
            {pointsToNext > 0
              ? t("gamification.pointsToNext", { count: pointsToNext })
              : t("gamification.maxLevel")}
          </p>
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
