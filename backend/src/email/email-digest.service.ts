import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { EmailPriority } from './constants';
import { TransactionalEmailService } from './transactional-email.service';

const MAX_DIGEST_USERS = 500;

/**
 * Weekly summary of {@link UserContentInteraction} rows (thin slice: top items per user by interactionCount).
 * Users may disable via `weekly_digest` in email preferences (see {@link TransactionalEmailService.canSend}).
 */
@Injectable()
export class EmailDigestService {
  private readonly logger = new Logger(EmailDigestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly transactionalEmail: TransactionalEmailService,
  ) {}

  /** Monday 09:00 UTC */
  @Cron('0 9 * * 1')
  async weeklyDigest(): Promise<void> {
    const since = new Date(Date.now() - 7 * 86400000);
    const interactions = await this.prisma.userContentInteraction.findMany({
      where: { lastInteractionAt: { gte: since } },
      orderBy: [{ interactionCount: 'desc' }, { lastInteractionAt: 'desc' }],
      take: 4000,
    });

    const byUser = new Map<string, typeof interactions>();
    for (const row of interactions) {
      const list = byUser.get(row.userId) ?? [];
      if (list.length < 5) {
        list.push(row);
        byUser.set(row.userId, list);
      }
    }

    const day = new Date().toISOString().split('T')[0];
    let queued = 0;

    for (const [userId, rows] of byUser) {
      if (queued >= MAX_DIGEST_USERS) break;
      if (!(await this.transactionalEmail.canSend(userId, 'weekly_digest'))) continue;

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true, emailVerified: true },
      });
      if (!user?.emailVerified) continue;

      const lines = rows
        .map(
          (r) =>
            `<li><strong>${escapeHtml(r.contentType)}</strong> — ${escapeHtml(r.contentId)} (${r.interactionCount}×)</li>`,
        )
        .join('');
      const html = `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1E1B4B;">Your weekly activity</h2>
          <p>Hi ${escapeHtml(user.name || 'there')}, here is content you engaged with recently (ranked by activity):</p>
          <ul style="padding-left: 1.25rem;">${lines}</ul>
        </div>`;

      const id = await this.emailService.enqueue({
        toEmail: user.email,
        toName: user.name,
        subject: 'Your OmniLearn weekly digest',
        htmlBody: html,
        emailType: 'notification',
        eventType: 'weekly_digest',
        priority: EmailPriority.LOW,
        triggeredBy: 'weekly_digest',
        userId,
        idempotencyKey: `weekly_digest:${userId}:${day}`,
        metadata: { week: day },
      });
      if (id) queued++;
    }

    this.logger.log(`Weekly digest: queued ${queued} (users with interactions in window)`);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
