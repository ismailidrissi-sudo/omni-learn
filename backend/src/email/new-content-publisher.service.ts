import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionalEmailService } from './transactional-email.service';

const MAX_RECIPIENTS_PER_PUBLISH = 500;
const COOLDOWN_MS = 48 * 3600_000;

/**
 * When a learning path is published, notifies verified users in the same tenant
 * (foundation for category-based “new content” mail; respects preferences + 48h cooldown).
 */
@Injectable()
export class NewContentPublisherService {
  private readonly logger = new Logger(NewContentPublisherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionalEmail: TransactionalEmailService,
  ) {}

  async publishLearningPathNotifications(pathId: string): Promise<{ queued: number; skipped: number }> {
    const path = await this.prisma.learningPath.findUnique({
      where: { id: pathId },
      include: { domain: true },
    });
    if (!path?.isPublished) {
      return { queued: 0, skipped: 0 };
    }

    const users = await this.prisma.user.findMany({
      where: {
        tenantId: path.tenantId,
        emailVerified: true,
      },
      select: { id: true, email: true, name: true },
      take: MAX_RECIPIENTS_PER_PUBLISH,
    });

    let queued = 0;
    let skipped = 0;

    const since = new Date(Date.now() - COOLDOWN_MS);

    for (const u of users) {
      const recent = await this.prisma.emailLog.count({
        where: {
          recipientUserId: u.id,
          eventType: 'new_content_in_category',
          createdAt: { gte: since },
        },
      });
      if (recent > 0) {
        skipped++;
        continue;
      }

      try {
        await this.transactionalEmail.sendNewLearningPathPublishedEmail({
          userId: u.id,
          toEmail: u.email,
          toName: u.name,
          pathName: path.name,
          domainName: path.domain?.name ?? '',
          pathId: path.id,
        });
        queued++;
      } catch (e) {
        this.logger.warn(`Failed to queue new-content email for user ${u.id}: ${e}`);
        skipped++;
      }
    }

    if (users.length >= MAX_RECIPIENTS_PER_PUBLISH) {
      this.logger.warn(
        `publishLearningPathNotifications capped at ${MAX_RECIPIENTS_PER_PUBLISH} for path ${pathId}`,
      );
    }

    this.logger.log(`New path ${pathId}: queued ${queued}, skipped ${skipped}`);
    return { queued, skipped };
  }
}
