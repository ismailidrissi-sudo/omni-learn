export const POINT_REASONS = {
  QUIZ_PASS_FIRST: 'quiz_pass_first',
  QUIZ_PASS_RETAKE: 'quiz_pass_retake',
  LESSON_COMPLETE: 'lesson_complete',
  VIDEO_COMPLETE: 'video_complete',
  PATH_COMPLETE: 'path_complete',
  DAILY_LOGIN: 'daily_login',
  ADMIN_GRANT: 'admin_grant',
  ADMIN_REVOKE: 'admin_revoke',
} as const;

export type PointReason = (typeof POINT_REASONS)[keyof typeof POINT_REASONS];

export const POINT_VALUES: Record<PointReason, number> = {
  [POINT_REASONS.QUIZ_PASS_FIRST]: 20,
  [POINT_REASONS.QUIZ_PASS_RETAKE]: 5,
  [POINT_REASONS.LESSON_COMPLETE]: 10,
  [POINT_REASONS.VIDEO_COMPLETE]: 5,
  [POINT_REASONS.PATH_COMPLETE]: 100,
  [POINT_REASONS.DAILY_LOGIN]: 2,
  [POINT_REASONS.ADMIN_GRANT]: 0,
  [POINT_REASONS.ADMIN_REVOKE]: 0,
};

// Progression levels — derived from cumulative UserPoints.points.
// minPoints is inclusive; users start at level 1 with 0 points.
export interface LevelDefinition {
  level: number;
  minPoints: number;
  labelKey: string; // i18n key fragment (e.g. "rookie")
}

export const LEVEL_THRESHOLDS: LevelDefinition[] = [
  { level: 1, minPoints: 0, labelKey: 'rookie' },
  { level: 2, minPoints: 50, labelKey: 'apprentice' },
  { level: 3, minPoints: 150, labelKey: 'learner' },
  { level: 4, minPoints: 300, labelKey: 'achiever' },
  { level: 5, minPoints: 500, labelKey: 'expert' },
  { level: 6, minPoints: 800, labelKey: 'mentor' },
  { level: 7, minPoints: 1200, labelKey: 'master' },
  { level: 8, minPoints: 1700, labelKey: 'champion' },
  { level: 9, minPoints: 2300, labelKey: 'luminary' },
  { level: 10, minPoints: 3000, labelKey: 'legend' },
];

export interface LevelSummary {
  level: number;
  labelKey: string;
  currentLevelMin: number;
  nextLevelMin: number | null; // null when at max level
  pointsToNext: number; // 0 when at max level
  progressToNextPct: number; // 0..100, 100 when at max level
}

export function computeLevel(points: number): LevelSummary {
  const safePoints = Math.max(0, Math.trunc(points));
  let current = LEVEL_THRESHOLDS[0];
  let next: LevelDefinition | undefined;

  for (let i = 0; i < LEVEL_THRESHOLDS.length; i += 1) {
    const tier = LEVEL_THRESHOLDS[i];
    if (safePoints >= tier.minPoints) {
      current = tier;
      next = LEVEL_THRESHOLDS[i + 1];
    } else {
      break;
    }
  }

  if (!next) {
    return {
      level: current.level,
      labelKey: current.labelKey,
      currentLevelMin: current.minPoints,
      nextLevelMin: null,
      pointsToNext: 0,
      progressToNextPct: 100,
    };
  }

  const span = next.minPoints - current.minPoints;
  const earned = safePoints - current.minPoints;
  const progressPct = span <= 0 ? 0 : Math.min(100, Math.round((earned / span) * 100));

  return {
    level: current.level,
    labelKey: current.labelKey,
    currentLevelMin: current.minPoints,
    nextLevelMin: next.minPoints,
    pointsToNext: Math.max(0, next.minPoints - safePoints),
    progressToNextPct: progressPct,
  };
}
