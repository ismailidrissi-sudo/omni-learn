import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import type { RequestUserPayload } from '../types/request-user.types';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const req = context.switchToHttp().getRequest<{ user?: RequestUserPayload }>();
    const user = req.user;
    const granted = new Set(user?.permissions ?? []);
    const ok = required.every((p) => granted.has(p));
    if (!ok) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}
