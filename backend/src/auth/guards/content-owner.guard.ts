import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { ContentType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RbacRole } from '../../constants/rbac.constant';
import type { RequestUserPayload } from '../types/request-user.types';

/**
 * For course content updates/deletes: only creator or super_admin (not company_admin bypass).
 */
@Injectable()
export class ContentOwnerGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ user?: RequestUserPayload; params?: { id?: string } }>();
    const user = req.user;
    if (!user) return true;

    if (user.roles.includes(RbacRole.SUPER_ADMIN)) return true;

    const id = req.params?.id;
    if (!id) return true;

    const item = await this.prisma.contentItem.findUnique({
      where: { id },
      select: { createdById: true, type: true },
    });
    if (!item || item.type !== ContentType.COURSE) return true;

    if (!item.createdById || item.createdById !== user.sub) {
      throw new ForbiddenException('You can only edit courses you created.');
    }
    return true;
  }
}
