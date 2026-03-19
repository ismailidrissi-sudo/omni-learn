import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionPlan } from './subscription.constants';

/**
 * Access Service — Tier-based content filtering
 * omnilearn.space | 4-tier subscription system
 */

export interface UserAccessContext {
  planId: SubscriptionPlan;
  sectorFocus: string | null;
  tenantId: string | null;
}

@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** Get access context for a user (or null for anonymous = Explorer) */
  async getAccessContext(userId: string | null): Promise<UserAccessContext> {
    if (!userId) {
      return {
        planId: SubscriptionPlan.EXPLORER,
        sectorFocus: null,
        tenantId: null,
      };
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { planId: true, sectorFocus: true, tenantId: true },
    });
    if (!user) {
      return {
        planId: SubscriptionPlan.EXPLORER,
        sectorFocus: null,
        tenantId: null,
      };
    }
    return {
      planId: user.planId as SubscriptionPlan,
      sectorFocus: user.sectorFocus,
      tenantId: user.tenantId,
    };
  }

  /** Build tenant-assignment filter: content with no assignments = public to all */
  private buildAssignmentFilter(ctx: UserAccessContext) {
    const noAssignments = { tenantAssignments: { none: {} } };
    if (ctx.tenantId) {
      return {
        OR: [
          noAssignments,
          { tenantAssignments: { some: { tenantId: ctx.tenantId } } },
        ],
      };
    }
    return noAssignments;
  }

  /** Build Prisma where clause for content filtering based on tier + assignments */
  buildContentWhere(ctx: UserAccessContext) {
    const planFilter = {
      availablePlans: { array_contains: [ctx.planId] },
    };
    const tierFilter: Record<string, unknown> = {};
    const assignmentFilter = this.buildAssignmentFilter(ctx);

    switch (ctx.planId) {
      case SubscriptionPlan.EXPLORER:
        tierFilter.OR = [
          { isFoundational: true },
          planFilter,
        ];
        break;

      case SubscriptionPlan.SPECIALIST:
        if (ctx.sectorFocus) {
          tierFilter.AND = [
            { tenantId: null },
            {
              OR: [
                planFilter,
                { sectorTag: ctx.sectorFocus },
                { isFoundational: true },
              ],
            },
          ];
        } else {
          tierFilter.OR = [
            { isFoundational: true },
            planFilter,
          ];
        }
        break;

      case SubscriptionPlan.VISIONARY:
        tierFilter.AND = [
          { tenantId: null },
          planFilter,
        ];
        break;

      case SubscriptionPlan.NEXUS:
        if (ctx.tenantId) {
          tierFilter.AND = [
            planFilter,
            {
              OR: [
                { tenantId: null },
                { tenantId: ctx.tenantId },
              ],
            },
          ];
        } else {
          tierFilter.AND = [
            { tenantId: null },
            planFilter,
          ];
        }
        break;

      default:
        tierFilter.OR = [
          { isFoundational: true },
          planFilter,
        ];
    }

    return { AND: [tierFilter, assignmentFilter] };
  }

  /** Check if user can access a specific content item */
  async canAccessContent(
    contentId: string,
    ctx: UserAccessContext,
  ): Promise<boolean> {
    const content = await this.prisma.contentItem.findUnique({
      where: { id: contentId },
      select: {
        isFoundational: true,
        sectorTag: true,
        tenantId: true,
        availablePlans: true,
        tenantAssignments: { select: { tenantId: true } },
      },
    });
    if (!content) return false;

    const assignedTenants = content.tenantAssignments.map((a) => a.tenantId);
    if (assignedTenants.length > 0 && ctx.tenantId && !assignedTenants.includes(ctx.tenantId)) {
      return false;
    }

    const plans = Array.isArray(content.availablePlans) ? content.availablePlans as string[] : [];
    const planAllowed = plans.includes(ctx.planId);

    switch (ctx.planId) {
      case SubscriptionPlan.EXPLORER:
        return content.isFoundational === true || planAllowed;

      case SubscriptionPlan.SPECIALIST:
        return (
          planAllowed ||
          content.isFoundational ||
          (!!ctx.sectorFocus && content.sectorTag === ctx.sectorFocus)
        );

      case SubscriptionPlan.VISIONARY:
        return planAllowed;

      case SubscriptionPlan.NEXUS:
        return (
          planAllowed &&
          (content.tenantId === null || content.tenantId === ctx.tenantId)
        );

      default:
        return content.isFoundational === true || planAllowed;
    }
  }

  /** Whether ads should be shown for this user */
  shouldShowAds(ctx: UserAccessContext): boolean {
    return ctx.planId === SubscriptionPlan.EXPLORER;
  }
}
