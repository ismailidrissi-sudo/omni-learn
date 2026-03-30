import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserAccountStatus } from '@prisma/client';
import { PREMIUM_ACTION_KEY } from '../decorators/premium-action.decorator';
import type { RequestUserPayload } from '../types/request-user.types';

@Injectable()
export class AccountStatusGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: RequestUserPayload }>();
    const user = req.user;
    if (!user) return true;

    if (user.accountStatus === UserAccountStatus.SUSPENDED) {
      throw new ForbiddenException('Account suspended. Contact support.');
    }

    const premium = this.reflector.getAllAndOverride<boolean>(PREMIUM_ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (premium && user.accountStatus === UserAccountStatus.PENDING_PLAN) {
      throw new ForbiddenException(
        'Account pending approval. Free content is available; premium actions are blocked.',
      );
    }

    if (user.accountStatus === UserAccountStatus.PENDING_COMPANY) {
      if (premium) {
        throw new ForbiddenException(
          'Your request to join a company is pending. Premium actions are blocked until approved.',
        );
      }
    }

    return true;
  }
}
