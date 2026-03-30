import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestUserPayload } from '../types/request-user.types';

/** @deprecated Use RequestUserPayload */
export type CurrentUserPayload = RequestUserPayload;

export const CurrentUser = createParamDecorator(
  (
    data: keyof RequestUserPayload | undefined,
    ctx: ExecutionContext,
  ): RequestUserPayload | RequestUserPayload[keyof RequestUserPayload] | undefined => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as RequestUserPayload;
    if (!data) return user;
    return user?.[data];
  },
);
