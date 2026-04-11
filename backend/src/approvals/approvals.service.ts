import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ApprovalRequestStatus,
  ApprovalRequestType,
  OrgApprovalStatus,
  Prisma,
  SubscriptionPlan,
  UserAccountStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionalEmailService } from '../email/transactional-email.service';
import { SeatLimitService } from '../company/seat-limit.service';

export type ApprovalActor = {
  userId: string;
  tenantId: string | null;
  permissions: string[];
};

@Injectable()
export class ApprovalsService {
  private readonly logger = new Logger(ApprovalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionalEmail: TransactionalEmailService,
    private readonly seatLimit: SeatLimitService,
  ) {}

  private canReviewAll(actor: ApprovalActor): boolean {
    return actor.permissions.includes('approvals:review_all');
  }

  private assertTenantAccess(actor: ApprovalActor, requestTenantId: string) {
    if (this.canReviewAll(actor)) return;
    if (!actor.tenantId || actor.tenantId !== requestTenantId) {
      throw new ForbiddenException('Cannot access approvals for this tenant');
    }
  }

  async list(actor: ApprovalActor, query: { status?: ApprovalRequestStatus; type?: ApprovalRequestType }) {
    const where: Prisma.ApprovalRequestWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (!this.canReviewAll(actor)) {
      if (!actor.tenantId) return [];
      where.tenantId = actor.tenantId;
    }
    return this.prisma.approvalRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        requester: { select: { id: true, name: true, email: true } },
        reviewer: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async getOne(actor: ApprovalActor, id: string) {
    const row = await this.prisma.approvalRequest.findUnique({
      where: { id },
      include: {
        requester: { select: { id: true, name: true, email: true, accountStatus: true } },
        reviewer: { select: { id: true, name: true, email: true } },
      },
    });
    if (!row) throw new NotFoundException('Approval not found');
    this.assertTenantAccess(actor, row.tenantId);
    return row;
  }

  async approve(actor: ApprovalActor, id: string, reviewNote?: string) {
    const row = await this.getOne(actor, id);
    if (row.status !== ApprovalRequestStatus.PENDING) {
      return row;
    }

    // Pre-validate payload to prevent "approved but nothing happened" states
    if (row.type === ApprovalRequestType.PLAN_UPGRADE) {
      const payload = (row.payload ?? {}) as { requested_plan?: string };
      if (!payload.requested_plan || !Object.values(SubscriptionPlan).includes(payload.requested_plan as SubscriptionPlan)) {
        throw new ForbiddenException('Approval payload is missing a valid requested_plan');
      }
    } else if (row.type === ApprovalRequestType.COMPANY_JOIN) {
      const payload = (row.payload ?? {}) as { company_tenant_id?: string };
      if (!payload.company_tenant_id) {
        throw new ForbiddenException('Approval payload is missing company_tenant_id');
      }
      if (payload.company_tenant_id !== row.tenantId) {
        throw new ForbiddenException('Payload tenant does not match approval request tenant');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // Conditional update ensures only one concurrent approver succeeds
      const claimed = await tx.approvalRequest.updateMany({
        where: { id, status: ApprovalRequestStatus.PENDING },
        data: {
          status: ApprovalRequestStatus.APPROVED,
          reviewerId: actor.userId,
          reviewNote: reviewNote ?? null,
          reviewedAt: new Date(),
        },
      });
      if (claimed.count === 0) {
        return tx.approvalRequest.findUniqueOrThrow({
          where: { id },
          include: { requester: { select: { id: true, name: true, email: true } } },
        });
      }

      if (row.type === ApprovalRequestType.PLAN_UPGRADE) {
        const payload = (row.payload ?? {}) as { requested_plan?: string };
        await tx.user.update({
          where: { id: row.requesterId },
          data: {
            accountStatus: UserAccountStatus.ACTIVE,
            planId: payload.requested_plan as SubscriptionPlan,
          },
        });
      } else if (row.type === ApprovalRequestType.COMPANY_JOIN) {
        await this.seatLimit.assertSeatAvailable(row.tenantId, 1, tx);
        await tx.user.update({
          where: { id: row.requesterId },
          data: {
            tenantId: row.tenantId,
            accountStatus: UserAccountStatus.ACTIVE,
            orgApprovalStatus: OrgApprovalStatus.APPROVED,
          },
        });
      } else if (row.type === ApprovalRequestType.PRIVATE_LABEL) {
        await tx.tenant.update({
          where: { id: row.tenantId },
          data: { tenantApprovalStatus: 'ACTIVE' },
        });
      }

      return tx.approvalRequest.findUniqueOrThrow({
        where: { id },
        include: { requester: { select: { id: true, name: true, email: true } } },
      });
    }).then((updated) => {
      if (row.type === ApprovalRequestType.PLAN_UPGRADE && updated.requester) {
        const u = updated.requester;
        this.transactionalEmail
          .sendPlanApprovedUser({
            userId: u.id,
            toEmail: u.email,
            toName: u.name,
          })
          .catch((e) => this.logger.warn(`plan approved email: ${e}`));
      }
      return updated;
    });
  }

  async reject(actor: ApprovalActor, id: string, reviewNote?: string) {
    const row = await this.getOne(actor, id);
    if (row.status !== ApprovalRequestStatus.PENDING) {
      return row;
    }

    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.approvalRequest.updateMany({
        where: { id, status: ApprovalRequestStatus.PENDING },
        data: {
          status: ApprovalRequestStatus.REJECTED,
          reviewerId: actor.userId,
          reviewNote: reviewNote ?? null,
          reviewedAt: new Date(),
        },
      });
      if (claimed.count === 0) {
        return tx.approvalRequest.findUniqueOrThrow({
          where: { id },
          include: { requester: { select: { id: true, name: true, email: true } } },
        });
      }

      if (row.type === ApprovalRequestType.PLAN_UPGRADE) {
        await tx.user.update({
          where: { id: row.requesterId },
          data: {
            accountStatus: UserAccountStatus.ACTIVE,
            planId: SubscriptionPlan.EXPLORER,
          },
        });
      } else if (row.type === ApprovalRequestType.COMPANY_JOIN) {
        await tx.user.update({
          where: { id: row.requesterId },
          data: {
            accountStatus: UserAccountStatus.ACTIVE,
            orgApprovalStatus: OrgApprovalStatus.REJECTED,
          },
        });
      }

      return tx.approvalRequest.findUniqueOrThrow({
        where: { id },
        include: { requester: { select: { id: true, name: true, email: true } } },
      });
    }).then((updated) => {
      if (row.type === ApprovalRequestType.PLAN_UPGRADE && updated.requester) {
        const u = updated.requester;
        this.transactionalEmail
          .sendPlanRejectedUser({
            userId: u.id,
            toEmail: u.email,
            toName: u.name,
            reviewNote,
          })
          .catch((e) => this.logger.warn(`plan rejected email: ${e}`));
      }
      return updated;
    });
  }

  async createRequest(data: {
    tenantId: string;
    type: ApprovalRequestType;
    requesterId: string;
    payload?: Prisma.InputJsonValue;
  }) {
    return this.prisma.approvalRequest.create({
      data: {
        tenantId: data.tenantId,
        type: data.type,
        requesterId: data.requesterId,
        payload: data.payload ?? {},
      },
    });
  }
}
