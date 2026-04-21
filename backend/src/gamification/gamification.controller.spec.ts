import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserAccountStatus } from '@prisma/client';
import { RbacGuard } from '../auth/guards/rbac.guard';
import { RbacRole } from '../constants/rbac.constant';
import type { RequestUserPayload } from '../auth/types/request-user.types';
import { GamificationController } from './gamification.controller';
import { GamificationService } from './gamification.service';

function learnerUser(): RequestUserPayload {
  return {
    sub: 'user-a',
    email: 'a@example.com',
    roles: [RbacRole.LEARNER_BASIC],
    rolesRaw: ['learner_basic'],
    permissions: [],
    tenantId: 'tenant-1',
    accountStatus: UserAccountStatus.ACTIVE,
    isAdmin: false,
  };
}

describe('GamificationController', () => {
  let controller: GamificationController;
  let gamification: Pick<GamificationService, 'getPoints'>;

  beforeEach(() => {
    gamification = {
      getPoints: jest.fn().mockResolvedValue(42),
    };
    controller = new GamificationController(gamification as GamificationService);
  });

  it('returns 403 when a non-elevated user requests another user points', async () => {
    await expect(
      controller.getPoints('user-b', learnerUser()),
    ).rejects.toThrow(ForbiddenException);
    expect(gamification.getPoints).not.toHaveBeenCalled();
  });
});

describe('GamificationController admin POST /gamification/points (RBAC)', () => {
  it('denies LEARNER_BASIC when route requires SUPER_ADMIN', () => {
    const reflector = new Reflector();
    const guard = new RbacGuard(reflector);
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([RbacRole.SUPER_ADMIN]);
    const ctx = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ roles: [RbacRole.LEARNER_BASIC] }),
      }),
    } as unknown as ExecutionContext;
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
