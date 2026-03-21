import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { TransactionalEmailService } from '../transactional-email.service';
import { EmailService } from '../email.service';
import { EmailPriority } from '../constants';
import { SuggestionEngineService } from './suggestion-engine.service';
import {
  contentSuggestionHtml,
  contentSuggestionSubject,
} from '../templates/content-suggestion.template';

const MAX_USERS_PER_RUN = 100;
const PLATFORM_NAME = process.env.PLATFORM_NAME || 'OmniLearn';
const COOLDOWN_48H_MS = 48 * 3_600_000;
const COOLDOWN_14D_MS = 14 * 24 * 3_600_000;
const EVENT_TYPE = 'content_suggestion';

@Injectable()
export class SuggestionSchedulerService {
  private readonly logger = new Logger(SuggestionSchedulerService.name);
  private readonly db: any;

  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionalEmail: TransactionalEmailService,
    private readonly emailService: EmailService,
    private readonly suggestionEngine: SuggestionEngineService,
  ) {
    this.db = prisma as any;
  }

  private baseUrl(): string {
    return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  }

  /** User model has no Prisma back-relation to CourseEnrollment; filter by id instead. */
  private async userIdsWithCourseEnrollment(): Promise<string[]> {
    const rows = await this.prisma.courseEnrollment.findMany({
      select: { userId: true },
      distinct: ['userId'],
    });
    return rows.map((r) => r.userId);
  }

  private async hasRecentSuggestionEmail(userId: string, cooldownMs: number): Promise<boolean> {
    const since = new Date(Date.now() - cooldownMs);
    const count = await this.db.emailLog.count({
      where: {
        recipientUserId: userId,
        eventType: EVENT_TYPE,
        createdAt: { gte: since },
      },
    });
    return count > 0;
  }

  /** Day 1 post-signup: verified users with no enrollments, created 23-25h ago */
  @Cron('0 10 * * *')
  async postSignupDay1(): Promise<void> {
    const now = Date.now();
    const from = new Date(now - 25 * 3_600_000);
    const to = new Date(now - 23 * 3_600_000);

    const enrolledIds = await this.userIdsWithCourseEnrollment();
    const users = await this.prisma.user.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        emailVerified: true,
        ...(enrolledIds.length > 0 ? { id: { notIn: enrolledIds } } : {}),
      },
      select: { id: true, email: true, name: true },
      take: MAX_USERS_PER_RUN,
    });

    this.logger.log(`postSignupDay1: found ${users.length} eligible users`);

    for (const user of users) {
      await this.sendSuggestion(user, 'post_signup', COOLDOWN_48H_MS, {
        heading: 'Welcome — start exploring!',
        intro: 'here are our top picks to help you get started.',
      });
    }
  }

  /** Day 3 post-signup: users created 71-73h ago with no enrollments */
  @Cron('0 10 * * *')
  async postSignupDay3(): Promise<void> {
    const now = Date.now();
    const from = new Date(now - 73 * 3_600_000);
    const to = new Date(now - 71 * 3_600_000);

    const enrolledIds = await this.userIdsWithCourseEnrollment();
    const users = await this.prisma.user.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        emailVerified: true,
        ...(enrolledIds.length > 0 ? { id: { notIn: enrolledIds } } : {}),
      },
      select: { id: true, email: true, name: true },
      take: MAX_USERS_PER_RUN,
    });

    this.logger.log(`postSignupDay3: found ${users.length} eligible users`);

    for (const user of users) {
      await this.sendSuggestion(user, 'trending', COOLDOWN_48H_MS, {
        heading: 'Trending this week',
        intro: "here\u2019s what\u2019s popular with learners like you.",
      });
    }
  }

  /** Day 7 post-signup: users created 167-169h ago with no enrollments */
  @Cron('0 10 * * *')
  async postSignupDay7(): Promise<void> {
    const now = Date.now();
    const from = new Date(now - 169 * 3_600_000);
    const to = new Date(now - 167 * 3_600_000);

    const enrolledIds = await this.userIdsWithCourseEnrollment();
    const users = await this.prisma.user.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        emailVerified: true,
        ...(enrolledIds.length > 0 ? { id: { notIn: enrolledIds } } : {}),
      },
      select: { id: true, email: true, name: true },
      take: MAX_USERS_PER_RUN,
    });

    this.logger.log(`postSignupDay7: found ${users.length} eligible users`);

    for (const user of users) {
      await this.sendSuggestion(user, 'curated', COOLDOWN_48H_MS, {
        heading: 'Curated just for you',
        intro: 'we hand-picked content we think you\u2019ll love.',
      });
    }
  }

  /** Re-engage users inactive for 14+ days (no interactions, updatedAt stale) */
  @Cron('0 11 * * *')
  async inactivityReengagement(): Promise<void> {
    const cutoff = new Date(Date.now() - 14 * 24 * 3_600_000);

    const users = await this.prisma.user.findMany({
      where: {
        emailVerified: true,
        updatedAt: { lt: cutoff },
        userContentInteractions: {
          none: { lastInteractionAt: { gte: cutoff } },
        },
      },
      select: { id: true, email: true, name: true },
      take: MAX_USERS_PER_RUN,
    });

    this.logger.log(`inactivityReengagement: found ${users.length} eligible users`);

    for (const user of users) {
      await this.sendSuggestion(user, 'reengagement', COOLDOWN_14D_MS, {
        heading: 'We miss you!',
        intro: "here\u2019s what\u2019s new since your last visit.",
      });
    }
  }

  private async sendSuggestion(
    user: { id: string; email: string; name: string },
    strategyLabel: string,
    cooldownMs: number,
    copy: { heading: string; intro: string },
  ): Promise<void> {
    try {
      if (!(await this.transactionalEmail.canSend(user.id, EVENT_TYPE))) {
        return;
      }

      if (await this.hasRecentSuggestionEmail(user.id, cooldownMs)) {
        return;
      }

      const items = await this.suggestionEngine.getSuggestions(user.id, strategyLabel, 5);
      if (items.length === 0) {
        return;
      }

      const subject = contentSuggestionSubject(strategyLabel, PLATFORM_NAME);
      const htmlBody = contentSuggestionHtml({
        name: user.name,
        heading: copy.heading,
        intro: copy.intro,
        items: items.map((item) => ({
          ...item,
          url: `${this.baseUrl()}/content/${encodeURIComponent(item.contentId)}`,
        })),
      });

      const day = new Date().toISOString().split('T')[0];

      await this.emailService.enqueue({
        toEmail: user.email,
        toName: user.name,
        subject,
        htmlBody,
        emailType: 'notification',
        eventType: EVENT_TYPE,
        priority: EmailPriority.LOW,
        triggeredBy: `suggestion_${strategyLabel}`,
        userId: user.id,
        idempotencyKey: `suggestion:${strategyLabel}:${user.id}:${day}`,
        metadata: { strategyLabel, itemCount: items.length },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to send ${strategyLabel} suggestion to user ${user.id}: ${error}`,
      );
    }
  }
}
