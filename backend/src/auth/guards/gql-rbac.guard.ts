import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { RbacRole } from '../../constants/rbac.constant';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class GqlRbacGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RbacRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length) return true;

    const gql = GqlExecutionContext.create(context);
    const req = gql.getContext().req;
    const user = req?.user;
    if (!user?.roles?.length) throw new ForbiddenException('Insufficient permissions');

    const hasRole = requiredRoles.some((role) => user.roles.includes(role));
    if (!hasRole) throw new ForbiddenException('Insufficient permissions');

    return true;
  }
}
