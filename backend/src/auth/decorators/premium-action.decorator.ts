import { SetMetadata } from '@nestjs/common';

/** When set, users with accountStatus PENDING_PLAN cannot access this handler. */
export const PREMIUM_ACTION_KEY = 'premiumAction';
export const PremiumAction = () => SetMetadata(PREMIUM_ACTION_KEY, true);
