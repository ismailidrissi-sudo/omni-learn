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

  /** Build Prisma where clause for content filtering based on tier */
  buildContentWhere(ctx: UserAccessContext) {
    const base: Record<string, unknown> = {};

    switch (ctx.planId) {
      case SubscriptionPlan.EXPLORER:
        // Tier 0: Only foundational content
        base.isFoundational = true;
        break;

      case SubscriptionPlan.SPECIALIST:
        // Tier 1: Content in user's chosen sector (platform content only)
        if (ctx.sectorFocus) {
          base.AND = [
            { tenantId: null },
            {
              OR: [
                { sectorTag: ctx.sectorFocus },
                { isFoundational: true },
              ],
            },
          ];
        } else {
          base.isFoundational = true;
        }
        break;

      case SubscriptionPlan.VISIONARY:
        // Tier 2: All platform content (tenantId null = public platform library)
        base.tenantId = null;
        break;

      case SubscriptionPlan.NEXUS:
        // Tier 3: Platform content + tenant's private content
        if (ctx.tenantId) {
          base.OR = [
            { tenantId: null },
            { tenantId: ctx.tenantId },
          ];
        } else {
          base.tenantId = null;
        }
        break;

      default:
        base.isFoundational = true;
    }

    return base;
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
      },
    });
    if (!content) return false;

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
