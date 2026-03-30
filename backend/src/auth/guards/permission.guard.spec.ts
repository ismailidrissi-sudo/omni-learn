import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PermissionGuard } from './permission.guard';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { UserAccountStatus } from '@prisma/client';

function mockContext(user: { permissions?: string[] }): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user: { ...user, sub: 'u1', roles: [], rolesRaw: [], tenantId: null, accountStatus: UserAccountStatus.ACTIVE, isAdmin: false } }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('PermissionGuard', () => {
  it('allows when no permissions required', () => {
    const g = new PermissionGuard(new Reflector());
    expect(g.canActivate(mockContext({ permissions: [] }))).toBe(true);
  });

  it('allows when user has all required permissions', () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['approvals:review']);
    const g = new PermissionGuard(reflector);
    expect(g.canActivate(mockContext({ permissions: ['approvals:review', 'users:manage'] }))).toBe(true);
  });

  it('forbids when a permission is missing', () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['approvals:review']);
    const g = new PermissionGuard(reflector);
    expect(() => g.canActivate(mockContext({ permissions: ['users:manage'] }))).toThrow(ForbiddenException);
  });
});
