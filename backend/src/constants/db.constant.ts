/**
 * Database enum values — compatible with both SQLite (string) and PostgreSQL (enum)
 * omnilearn.space | Afflatus Consulting Group
 */

export const EnrollmentStatus = {
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  DROPPED: 'DROPPED',
  EXPIRED: 'EXPIRED',
} as const;

export const StepProgressStatus = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
} as const;
