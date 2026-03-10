import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Optional JWT Guard — Validates JWT when present, does not reject when absent
 * Use for routes that work for both authenticated and anonymous users
 */
@Injectable()
export class OptionalJwtGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      return (await super.canActivate(context)) as boolean;
    } catch {
      const request = context.switchToHttp().getRequest();
      request.user = null;
      return true;
    }
  }

  handleRequest<TUser>(err: Error | null, user: TUser | false): TUser | null {
    if (err || !user) return null;
    return user;
  }
}
