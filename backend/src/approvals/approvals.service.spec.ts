import { Test } from '@nestjs/testing';
import { ApprovalsService } from './approvals.service';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionalEmailService } from '../email/transactional-email.service';
import { ApprovalRequestStatus, ApprovalRequestType } from '@prisma/client';

describe('ApprovalsService', () => {
  it('approve is idempotent when already approved', async () => {
    const prisma = {
      approvalRequest: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'a1',
          tenantId: 't1',
          type: ApprovalRequestType.PLAN_UPGRADE,
          status: ApprovalRequestStatus.APPROVED,
          requesterId: 'u1',
          reviewerId: 'admin',
          payload: {},
          reviewNote: null,
          createdAt: new Date(),
          reviewedAt: new Date(),
          requester: { id: 'u1', name: 'U', email: 'u@test.com' },
          reviewer: null,
        }),
      },
      $transaction: jest.fn(),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ApprovalsService,
        { provide: PrismaService, useValue: prisma },
        { provide: TransactionalEmailService, useValue: { sendPlanApprovedUser: jest.fn() } },
      ],
    }).compile();
    const svc = moduleRef.get(ApprovalsService);
    const actor = { userId: 'admin', tenantId: 't1', permissions: ['approvals:review_all'] };
    const out = await svc.approve(actor, 'a1');
    expect(out.status).toBe(ApprovalRequestStatus.APPROVED);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
