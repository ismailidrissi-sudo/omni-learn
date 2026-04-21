import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionPlan } from './subscription.constants';
import { effectiveSubscriptionPlan } from './tenant-plan.util';
import {
  TenantCacheService,
  TenantContentAccessEntry,
} from '../company/tenant-cache.service';

/**
 * Access Service — Tier-based content filtering + tenant entitlements
 * omnilearn.space | Multi-tenant access resolution
 *
 * Resolution order (Section 3.1 of architecture doc):
 *   1. Org approval gate
 *   2. Tenant assignment + bypassesPublicPaywall
 *   3. Tier-based plan rules (fallback)
 */

export interface UserAccessContext {
  planId: SubscriptionPlan;
  sectorFocus: string | null;
  tenantId: string | null;
  orgApprovalStatus: string | null;
}

export type AccessResult = {
  hasAccess: boolean;
  /** True when access was granted via tenant assignment paywall bypass */
  bypassedPaywall: boolean;
};

@Injectable()
export class AccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCache: TenantCacheService,
  ) {}

  /** Get access context for a user (or null for anonymous = Explorer) */
  async getAccessContext(userId: string | null): Promise<UserAccessContext> {
    if (!userId) {
      return {
        planId: SubscriptionPlan.EXPLORER,
        sectorFocus: null,
        tenantId: null,
        orgApprovalStatus: null,
      };
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        planId: true,
        sectorFocus: true,
        tenantId: true,
        orgApprovalStatus: true,
        tenant: { select: { settings: true } },
      },
    });
    if (!user) {
      return {
        planId: SubscriptionPlan.EXPLORER,
        sectorFocus: null,
        tenantId: null,
        orgApprovalStatus: null,
      };
    }
    const planId = effectiveSubscriptionPlan({
      userPlanId: user.planId as SubscriptionPlan,
      tenantId: user.tenantId,
      orgApprovalStatus: user.orgApprovalStatus,
      tenantSettings: user.tenant?.settings ?? null,
    });
    return {
      planId,
      sectorFocus: user.sectorFocus,
      tenantId: user.tenantId,
      orgApprovalStatus: user.orgApprovalStatus,
    };
  }

  // ── Prisma list-filter (unchanged — used for catalog queries) ──────────

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
    // Legacy rows that pre-date the availablePlans field may have it stored as
    // `null` (Prisma Json). Treat missing values as "all plans allowed" so we
    // don't retroactively lock out previously-public content.
    const planFilter = {
      OR: [
        { availablePlans: { equals: Prisma.DbNull } },
        { availablePlans: { equals: Prisma.JsonNull } },
        { availablePlans: { array_contains: [ctx.planId] } },
      ],
    };
    const tierFilter: Record<string, unknown> = {};
    const assignmentFilter = this.buildAssignmentFilter(ctx);

    switch (ctx.planId) {
      case SubscriptionPlan.EXPLORER:
        tierFilter.OR = [{ isFoundational: true }, planFilter];
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
          tierFilter.OR = [{ isFoundational: true }, planFilter];
        }
        break;

      case SubscriptionPlan.VISIONARY:
        tierFilter.AND = [{ tenantId: null }, planFilter];
        break;

      case SubscriptionPlan.NEXUS:
        if (ctx.tenantId) {
          tierFilter.AND = [
            planFilter,
            {
              OR: [{ tenantId: null }, { tenantId: ctx.tenantId }],
            },
          ];
        } else {
          tierFilter.AND = [{ tenantId: null }, planFilter];
        }
        break;

      default:
        tierFilter.OR = [{ isFoundational: true }, planFilter];
    }

    // For tenant users with bypass, also include content assigned to their tenant
    if (ctx.tenantId && ctx.orgApprovalStatus === 'APPROVED') {
      return {
        OR: [
          { AND: [tierFilter, assignmentFilter] },
          {
            tenantAssignments: {
              some: { tenantId: ctx.tenantId, bypassesPublicPaywall: true },
            },
          },
        ],
      };
    }

    return { AND: [tierFilter, assignmentFilter] };
  }

  // ── Single-item access check (rewritten with new resolution order) ─────

  /**
   * Check if user can access a specific content item.
   * Returns both the access decision and whether the paywall was bypassed
   * (so frontend can hide pricing).
   */
  async canAccessContentDetailed(
    contentId: string,
    ctx: UserAccessContext,
    userId?: string | null,
  ): Promise<AccessResult> {
    // Step 0: Enrolled users always have access
    if (userId) {
      const enrolled = await this.isEnrolled(userId, contentId);
      if (enrolled) {
        return { hasAccess: true, bypassedPaywall: false };
      }
    }

    // Step 1: Org approval gate
    if (ctx.tenantId && ctx.orgApprovalStatus !== 'APPROVED') {
      return { hasAccess: false, bypassedPaywall: false };
    }

    // Step 2: Tenant assignment + paywall bypass (cached)
    if (ctx.tenantId) {
      const assignment = await this.resolveTenantAssignment(
        ctx.tenantId,
        contentId,
      );
      if (assignment.assigned && assignment.bypassesPublicPaywall) {
        return { hasAccess: true, bypassedPaywall: true };
      }
      // If content is assigned to specific tenants but NOT this one, deny
      if (await this.isExclusiveToOtherTenants(contentId, ctx.tenantId)) {
        return { hasAccess: false, bypassedPaywall: false };
      }
    }

    // Step 3: Fallback to tier-based access rules
    const tierAccess = await this.checkTierAccess(contentId, ctx);
    return { hasAccess: tierAccess, bypassedPaywall: false };
  }

  /** Backward-compatible boolean wrapper */
  async canAccessContent(
    contentId: string,
    ctx: UserAccessContext,
    userId?: string | null,
  ): Promise<boolean> {
    const result = await this.canAccessContentDetailed(contentId, ctx, userId);
    return result.hasAccess;
  }

  /** Whether ads should be shown for this user */
  shouldShowAds(ctx: UserAccessContext): boolean {
    return ctx.planId === SubscriptionPlan.EXPLORER;
  }

  // ── Private helpers ────────────────────────────────────────────────────

  /** Check if user is enrolled in this content (course enrollment or learning path step) */
  private async isEnrolled(
    userId: string,
    contentId: string,
  ): Promise<boolean> {
    const courseEnrollment = await this.prisma.courseEnrollment.findUnique({
      where: { userId_courseId: { userId, courseId: contentId } },
      select: { id: true },
    });
    if (courseEnrollment) return true;

    const pathStep = await this.prisma.pathEnrollment.findFirst({
      where: {
        userId,
        path: { steps: { some: { contentItemId: contentId } } },
      },
      select: { id: true },
    });
    return !!pathStep;
  }

  private async resolveTenantAssignment(
    tenantId: string,
    contentId: string,
  ): Promise<TenantContentAccessEntry> {
    const cached = await this.tenantCache.getTenantContentAccess(
      tenantId,
      contentId,
    );
    if (cached) return cached;

    const row = await this.prisma.contentTenantAssignment.findUnique({
      where: { contentId_tenantId: { contentId, tenantId } },
      select: { bypassesPublicPaywall: true },
    });

    const entry: TenantContentAccessEntry = row
      ? { assigned: true, bypassesPublicPaywall: row.bypassesPublicPaywall }
      : { assigned: false, bypassesPublicPaywall: false };

    await this.tenantCache.setTenantContentAccess(
      tenantId,
      contentId,
      entry,
    );
    return entry;
  }

  /**
   * Check if content has tenant assignments that exclude the current tenant.
   * Content with zero assignments is "public to all."
   */
  private async isExclusiveToOtherTenants(
    contentId: string,
    tenantId: string,
  ): Promise<boolean> {
    const assignmentCount = await this.prisma.contentTenantAssignment.count({
      where: { contentId },
    });
    if (assignmentCount === 0) return false; // public content
    const hasOurs = await this.prisma.contentTenantAssignment.count({
      where: { contentId, tenantId },
    });
    return hasOurs === 0;
  }

  /** Original tier-based access check (unchanged logic) */
  private async checkTierAccess(
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
      },
    });
    if (!content) return false;

    // Legacy rows may have availablePlans stored as `null` (Prisma Json).
    // Treat missing values as "all plans allowed" so we don't retroactively
    // lock out content that was previously public.
    const isLegacyUnset =
      content.availablePlans == null || !Array.isArray(content.availablePlans);
    const plans = Array.isArray(content.availablePlans)
      ? (content.availablePlans as string[])
      : [];
    const planAllowed = isLegacyUnset || plans.includes(ctx.planId);

    switch (ctx.planId) {
      case SubscriptionPlan.EXPLORER:
        return content.isFoundational === true || planAllowed;

      case SubscriptionPlan.SPECIALIST:
        if (content.tenantId !== null) return false;
        return (
          planAllowed ||
          content.isFoundational ||
          (!!ctx.sectorFocus && content.sectorTag === ctx.sectorFocus)
        );

      case SubscriptionPlan.VISIONARY:
        if (content.tenantId !== null) return false;
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
}
