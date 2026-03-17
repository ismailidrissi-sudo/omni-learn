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
    const tierFilter: Record<string, unknown> = {};
    const assignmentFilter = this.buildAssignmentFilter(ctx);

    switch (ctx.planId) {
      case SubscriptionPlan.EXPLORER:
        tierFilter.isFoundational = true;
        break;

      case SubscriptionPlan.SPECIALIST:
        if (ctx.sectorFocus) {
          tierFilter.AND = [
            { tenantId: null },
            {
              OR: [
                { sectorTag: ctx.sectorFocus },
                { isFoundational: true },
              ],
            },
          ];
        } else {
          tierFilter.isFoundational = true;
        }
        break;

      case SubscriptionPlan.VISIONARY:
        tierFilter.tenantId = null;
        break;

      case SubscriptionPlan.NEXUS:
        if (ctx.tenantId) {
          tierFilter.OR = [
            { tenantId: null },
            { tenantId: ctx.tenantId },
          ];
        } else {
          tierFilter.tenantId = null;
        }
        break;

      default:
        tierFilter.isFoundational = true;
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
        tenantAssignments: { select: { tenantId: true } },
      },
    });
    if (!content) return false;

    const assignedTenants = content.tenantAssignments.map((a) => a.tenantId);
    if (assignedTenants.length > 0 && ctx.tenantId && !assignedTenants.includes(ctx.tenantId)) {
      return false;
    }

    switch (ctx.planId) {
      case SubscriptionPlan.EXPLORER:
        return content.isFoundational === true;

      case SubscriptionPlan.SPECIALIST:
        return (
          content.isFoundational ||
          (!!ctx.sectorFocus && content.sectorTag === ctx.sectorFocus)
        );

      case SubscriptionPlan.VISIONARY:
        return true;

      case SubscriptionPlan.NEXUS:
        return (
          content.tenantId === null ||
          content.tenantId === ctx.tenantId
        );

      default:
        return content.isFoundational === true;
    }
  }

  /** Whether ads should be shown for this user */
  shouldShowAds(ctx: UserAccessContext): boolean {
    return ctx.planId === SubscriptionPlan.EXPLORER;
  }
}
