export enum EmailPriority {
  CRITICAL = 0,
  HIGH = 1,
  NORMAL = 2,
  LOW = 3,
}

/**
 * Maps numeric priority to Prisma enum value.
 * Prisma stores the enum name; the numeric value is used internally for ordering.
 */
export const PRIORITY_TO_ENUM = {
  [EmailPriority.CRITICAL]: 'CRITICAL',
  [EmailPriority.HIGH]: 'HIGH',
  [EmailPriority.NORMAL]: 'NORMAL',
  [EmailPriority.LOW]: 'LOW',
} as const;

export const ENUM_TO_PRIORITY: Record<string, EmailPriority> = {
  CRITICAL: EmailPriority.CRITICAL,
  HIGH: EmailPriority.HIGH,
  NORMAL: EmailPriority.NORMAL,
  LOW: EmailPriority.LOW,
};

export const EMAIL_TYPES = [
  'verification',
  'password_reset',
  'welcome',
  'referral_invitation',
  'course_enrollment',
  'course_reminder',
  'certificate',
  'notification',
  'marketing',
  'test',
  'transactional',
] as const;

export type EmailType = (typeof EMAIL_TYPES)[number];

export const BATCH_SIZE = 20;
export const SEND_DELAY_MS = 150;
export const MAX_ATTEMPTS = 3;
