import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EmailConfigService } from './email-config.service';
import { ResendClientService, ResendError, ResendRateLimitError } from './resend-client.service';
import { RateLimiterService } from './rate-limiter.service';
import { EmailPriority, ENUM_TO_PRIORITY, BATCH_SIZE, SEND_DELAY_MS } from './constants';

interface QueueRow {
  id: string;
  toEmail: string;
  toName: string | null;
  fromEmail: string | null;
  fromName: string | null;
  replyTo: string | null;
  subject: string;
  htmlBody: string;
  textBody: string | null;
  priority: string;
  attempts: number;
  maxAttempts: number;
}

@Injectable()
export class EmailProcessorService {
  private readonly logger = new Logger(EmailProcessorService.name);
  private processing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: EmailConfigService,
    private readonly resendClient: ResendClientService,
    private readonly rateLimiter: RateLimiterService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    if (this.processing) {
      this.logger.debug('Processor already running, skipping tick');
      return;
    }
    this.processing = true;
    try {
      await this.processQueue();
    } catch (e) {
      this.logger.error(`Email processor error: ${e}`);
    } finally {
      this.processing = false;
    }
  }

  async processQueue(): Promise<void> {
    let config;
    try {
      config = await this.configService.getConfig();
    } catch {
      this.logger.debug('No email config found, skipping processor tick');
      return;
    }

    if (!config.isActive) {
      this.logger.debug('Email system disabled, skipping');
      return;
    }

    const now = new Date();

    // Use raw SQL for FOR UPDATE SKIP LOCKED (Prisma doesn't support this natively)
    const emails: QueueRow[] = await this.prisma.$queryRaw`
      SELECT id, "toEmail", "toName", "fromEmail", "fromName", "replyTo",
             subject, "htmlBody", "textBody", priority, attempts, "maxAttempts"
      FROM email_queue
      WHERE (
        (status = 'PENDING')
        OR (status = 'SCHEDULED' AND "scheduledFor" <= ${now})
        OR (status = 'FAILED' AND attempts < "maxAttempts" AND "nextRetryAt" <= ${now})
      )
      ORDER BY
        CASE priority
          WHEN 'CRITICAL' THEN 0
          WHEN 'HIGH' THEN 1
          WHEN 'NORMAL' THEN 2
          WHEN 'LOW' THEN 3
        END ASC,
        "createdAt" ASC
      LIMIT ${BATCH_SIZE}
      FOR UPDATE SKIP LOCKED
    `;

    if (!emails.length) return;

    let remaining = await this.rateLimiter.getRemainingToday();
    let sent = 0;
    let deferred = 0;

    for (const email of emails) {
      const priority = ENUM_TO_PRIORITY[email.priority] ?? EmailPriority.NORMAL;
      const isCritical = priority === EmailPriority.CRITICAL;

      if (!isCritical && remaining <= 0) {
        await this.rescheduleToNextDay(email.id, config.overflowSendHour);
        deferred++;
        continue;
      }

      try {
        await this.prisma.emailQueue.update({
          where: { id: email.id },
          data: { status: 'SENDING', updatedAt: new Date() },
        });

        const result = await this.resendClient.send({
          toEmail: email.toEmail,
          subject: email.subject,
          htmlBody: email.htmlBody,
          toName: email.toName || undefined,
          fromEmail: email.fromEmail || undefined,
          fromName: email.fromName || undefined,
          replyTo: email.replyTo || undefined,
          textBody: email.textBody || undefined,
        });

        await this.prisma.emailQueue.update({
          where: { id: email.id },
          data: {
            status: 'SENT',
            resendId: result.id,
            sentAt: new Date(),
            updatedAt: new Date(),
          },
        });

        if (!isCritical) {
          await this.rateLimiter.incrementDailyCount();
          remaining--;
        }

        sent++;
        this.logger.log(`Sent email ${email.id} to ${email.toEmail} (resend_id=${result.id})`);

        await this.sleep(SEND_DELAY_MS);
      } catch (e) {
        if (e instanceof ResendRateLimitError) {
          this.logger.warn('Resend rate limit hit, pausing processor');
          await this.prisma.emailQueue.update({
            where: { id: email.id },
            data: {
              status: 'PENDING',
              lastError: 'Resend rate limit',
              updatedAt: new Date(),
            },
          });
          await this.sleep(5000);
          break;
        }

        const attempts = email.attempts + 1;
        const maxAttempts = email.maxAttempts;
        const errorMsg = e instanceof Error ? e.message : String(e);

        let nextRetryAt: Date | null = null;
        if (attempts < maxAttempts) {
          const backoffMinutes = Math.pow(5, attempts - 1); // 1, 5, 25
          nextRetryAt = new Date(Date.now() + backoffMinutes * 60_000);
          this.logger.warn(
            `Email ${email.id} failed (attempt ${attempts}), retry at ${nextRetryAt.toISOString()}: ${errorMsg}`,
          );
        } else {
          this.logger.error(
            `Email ${email.id} permanently failed after ${attempts} attempts: ${errorMsg}`,
          );
        }

        await this.prisma.emailQueue.update({
          where: { id: email.id },
          data: {
            status: 'FAILED',
            attempts,
            lastError: errorMsg,
            nextRetryAt,
            updatedAt: new Date(),
          },
        });

        await this.rateLimiter.incrementFailedCount();
      }
    }

    if (sent > 0 || deferred > 0) {
      this.logger.log(`Queue tick: ${sent} sent, ${deferred} deferred`);
    }
  }

  private async rescheduleToNextDay(emailId: string, overflowHour: number): Promise<void> {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(overflowHour, 0, 0, 0);

    const tomorrowBucket = new Date(tomorrow.toISOString().split('T')[0]);

    await this.prisma.emailQueue.update({
      where: { id: emailId },
      data: {
        status: 'SCHEDULED',
        scheduledFor: tomorrow,
        dayBucket: tomorrowBucket,
        updatedAt: new Date(),
      },
    });

    await this.rateLimiter.incrementOverflowCount();
    this.logger.log(`Email ${emailId} rescheduled to ${tomorrow.toISOString()}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
