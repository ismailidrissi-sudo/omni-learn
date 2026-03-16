import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RbacGuard } from './rbac.guard';
import { RbacRole } from '../../constants/rbac.constant';

describe('RbacGuard', () => {
  let guard: RbacGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RbacGuard(reflector);
  });

  function createContext(user: { roles: string[] } | undefined, requiredRoles: RbacRole[] | undefined): ExecutionContext {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredRoles);
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  it('should allow access when no roles required', () => {
    const ctx = createContext(undefined, undefined);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow access when no roles array is empty', () => {
    const ctx = createContext(undefined, []);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should throw ForbiddenException when user has no roles', () => {
    const ctx = createContext({ roles: [] }, [RbacRole.SUPER_ADMIN]);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should allow access when user has matching role', () => {
    const ctx = createContext({ roles: [RbacRole.SUPER_ADMIN] }, [RbacRole.SUPER_ADMIN]);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow access when user has one of the required roles', () => {
    const ctx = createContext(
      { roles: [RbacRole.INSTRUCTOR] },
      [RbacRole.SUPER_ADMIN, RbacRole.INSTRUCTOR],
    );
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should throw ForbiddenException when user role does not match', () => {
    const ctx = createContext(
      { roles: [RbacRole.LEARNER_BASIC] },
      [RbacRole.SUPER_ADMIN],
    );
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
