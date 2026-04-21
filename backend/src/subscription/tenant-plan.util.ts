import { SubscriptionPlan } from './subscription.constants';

const PLAN_VALUES = new Set<string>(Object.values(SubscriptionPlan));

/**
 * Read `settings.plan` from a Tenant JSON settings blob (academy / company tier).
 */
export function resolveTenantAcademyPlanId(settings: unknown): SubscriptionPlan | null {
  if (!settings || typeof settings !== 'object') return null;
  const plan = (settings as Record<string, unknown>).plan;
  if (typeof plan !== 'string') return null;
  const upper = plan.trim().toUpperCase();
  if (PLAN_VALUES.has(upper)) {
    return upper as SubscriptionPlan;
  }
  return null;
}

/**
 * Approved academy members use the tenant's configured plan; others use personal planId.
 */
export function effectiveSubscriptionPlan(opts: {
  userPlanId: SubscriptionPlan;
  tenantId: string | null;
  orgApprovalStatus: string | null;
  tenantSettings: unknown;
}): SubscriptionPlan {
  if (opts.tenantId && opts.orgApprovalStatus === 'APPROVED') {
    const fromTenant = resolveTenantAcademyPlanId(opts.tenantSettings);
    if (fromTenant) return fromTenant;
  }
  return opts.userPlanId;
}
