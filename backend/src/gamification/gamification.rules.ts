export const POINT_REASONS = {
  QUIZ_PASS_FIRST: 'quiz_pass_first',
  QUIZ_PASS_RETAKE: 'quiz_pass_retake',
  LESSON_COMPLETE: 'lesson_complete',
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
  [POINT_REASONS.PATH_COMPLETE]: 100,
  [POINT_REASONS.DAILY_LOGIN]: 2,
  [POINT_REASONS.ADMIN_GRANT]: 0,
  [POINT_REASONS.ADMIN_REVOKE]: 0,
};
