/**
 * Subscription tier constants
 * omnilearn.space | 4-tier subscription system
 */

export enum SubscriptionPlan {
  EXPLORER = 'EXPLORER',
  SPECIALIST = 'SPECIALIST',
  VISIONARY = 'VISIONARY',
  NEXUS = 'NEXUS',
}

export const TIER_ACCESS_LEVEL = {
  [SubscriptionPlan.EXPLORER]: 0,
  [SubscriptionPlan.SPECIALIST]: 1,
  [SubscriptionPlan.VISIONARY]: 2,
  [SubscriptionPlan.NEXUS]: 3,
} as const;
