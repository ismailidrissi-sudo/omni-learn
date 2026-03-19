import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailConfigService } from './email-config.service';
import { EmailPriority } from './constants';

@Injectable()
export class RateLimiterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: EmailConfigService,
  ) {}

  async getDailySendCount(day?: Date): Promise<number> {
    const bucket = day || new Date();
    const dateStr = bucket.toISOString().split('T')[0];

    const stats = await this.prisma.emailDailyStats.findUnique({
      where: { dayBucket: new Date(dateStr) },
    });

    return stats?.sentCount ?? 0;
  }

  async incrementDailyCount(day?: Date): Promise<number> {
    const bucket = day || new Date();
    const dateStr = bucket.toISOString().split('T')[0];
    const dayDate = new Date(dateStr);

    const result = await this.prisma.$executeRaw`
      INSERT INTO email_daily_stats ("dayBucket", "sentCount", "updatedAt")
      VALUES (${dayDate}::date, 1, NOW())
      ON CONFLICT ("dayBucket") DO UPDATE SET
        "sentCount" = email_daily_stats."sentCount" + 1,
        "updatedAt" = NOW()
    `;

    const stats = await this.prisma.emailDailyStats.findUnique({
      where: { dayBucket: dayDate },
    });
    return stats?.sentCount ?? 1;
  }

  async incrementFailedCount(day?: Date): Promise<void> {
    const bucket = day || new Date();
    const dateStr = bucket.toISOString().split('T')[0];
    const dayDate = new Date(dateStr);

    await this.prisma.$executeRaw`
      INSERT INTO email_daily_stats ("dayBucket", "failedCount", "updatedAt")
      VALUES (${dayDate}::date, 1, NOW())
      ON CONFLICT ("dayBucket") DO UPDATE SET
        "failedCount" = email_daily_stats."failedCount" + 1,
        "updatedAt" = NOW()
    `;
  }

  async incrementOverflowCount(day?: Date): Promise<void> {
    const bucket = day || new Date();
    const dateStr = bucket.toISOString().split('T')[0];
    const dayDate = new Date(dateStr);

    await this.prisma.$executeRaw`
      INSERT INTO email_daily_stats ("dayBucket", "scheduledOverflowCount", "updatedAt")
      VALUES (${dayDate}::date, 1, NOW())
      ON CONFLICT ("dayBucket") DO UPDATE SET
        "scheduledOverflowCount" = email_daily_stats."scheduledOverflowCount" + 1,
        "updatedAt" = NOW()
    `;
  }

  async canSendToday(priority: number = EmailPriority.NORMAL): Promise<boolean> {
    if (priority === EmailPriority.CRITICAL) {
      return true;
    }

    const config = await this.configService.getConfig();
    const currentCount = await this.getDailySendCount();
    return currentCount < config.dailySendLimit;
  }

  async getRemainingToday(): Promise<number> {
    const config = await this.configService.getConfig();
    const current = await this.getDailySendCount();
    return Math.max(0, config.dailySendLimit - current);
  }
}
