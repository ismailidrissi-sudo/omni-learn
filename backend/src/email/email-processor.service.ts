import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EmailConfigService } from './email-config.service';
import { EmailProviderConfigService } from './email-provider-config.service';
import { ResendRateLimitError } from './resend-client.service';
import { RateLimiterService } from './rate-limiter.service';
import { EmailPriority, ENUM_TO_PRIORITY, BATCH_SIZE, SEND_DELAY_MS } from './constants';
import { EmailProvider } from './providers/email-provider.interface';
import { ResendEmailProvider } from './providers/resend-email.provider';
import { SmtpEmailProvider } from './providers/smtp-email.provider';

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

  private readonly db: any;
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: EmailConfigService,
    private readonly providerConfigService: EmailProviderConfigService,
    private readonly resendProvider: ResendEmailProvider,
    private readonly smtpProvider: SmtpEmailProvider,
    private readonly rateLimiter: RateLimiterService,
  ) {
    this.db = prisma as any;
  }

  private pickProvider(): EmailProvider {
    return process.env.EMAIL_TRANSPORT === 'smtp' ? this.smtpProvider : this.resendProvider;
  }

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
    const providerConfig = await this.providerConfigService.getActiveConfig();

    let legacyConfig: any = null;
    if (!providerConfig) {
      try {
        legacyConfig = await this.configService.getConfig();
      } catch {
        this.logger.debug('No email config found, skipping processor tick');
        return;
      }
      if (!legacyConfig.isActive) {
        this.logger.debug('Email system disabled, skipping');
        return;
      }
    }

    const now = new Date();
    const provider = providerConfig
      ? this.providerConfigService.resolveProvider(providerConfig)
      : this.pickProvider();

    const emails: QueueRow[] = await this.prisma.$queryRaw`
      SELECT id, "toEmail", "toName", "fromEmail", "fromName", "replyTo",
             subject, "htmlBody", "textBody", priority, attempts, "maxAttempts"
      FROM email_queue
      WHERE (
        (status = 'PENDING')
        OR (status = 'SCHEDULED' AND "scheduledFor" <= ${now})
        OR (status = 'FAILED' AND attempts < "maxAttempts" AND "nextRetryAt" <= ${now})
      )
      AND ("scheduledAfter" IS NULL OR "scheduledAfter" <= ${now})
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

    let usage = providerConfig
      ? await this.providerConfigService.getCurrentUsage(providerConfig.id)
      : null;
    let legacyRemaining = !providerConfig
      ? await this.rateLimiter.getRemainingToday()
      : 0;

    let sent = 0;
    let deferred = 0;
    const overflowHour = legacyConfig?.overflowSendHour ?? 6;

    for (const email of emails) {
      const priority = ENUM_TO_PRIORITY[email.priority] ?? EmailPriority.NORMAL;
      const isCritical = priority === EmailPriority.CRITICAL;

      if (!isCritical) {
        const atLimit = providerConfig
          ? !this.providerConfigService.canSend(usage!)
          : legacyRemaining <= 0;

        if (atLimit) {
          await this.rescheduleToNextDay(email.id, overflowHour);
          deferred++;
          continue;
        }
      }

      const toAddr = email.toEmail.trim().toLowerCase();
      const suppressed = await (this.prisma as any).emailBounceSuppression.findUnique({
        where: { email: toAddr },
      });
      if (suppressed) {
        await this.db.emailQueue.update({
          where: { id: email.id },
          data: {
            status: 'CANCELLED',
            lastError: 'suppressed:bounce',
            updatedAt: new Date(),
          },
        });
        continue;
      }

      try {
        await this.db.emailQueue.update({
          where: { id: email.id },
          data: { status: 'SENDING', updatedAt: new Date() },
        });

        const result = await provider.send({
          toEmail: email.toEmail,
          subject: email.subject,
          htmlBody: email.htmlBody,
          toName: email.toName || undefined,
          fromEmail: email.fromEmail || undefined,
          fromName: email.fromName || undefined,
          replyTo: email.replyTo || undefined,
          textBody: email.textBody || undefined,
        });

        await this.db.emailQueue.update({
          where: { id: email.id },
          data: {
            status: 'SENT',
            resendId: result.id,
            sentAt: new Date(),
            updatedAt: new Date(),
          },
        });

        await this.db.emailLog.updateMany({
          where: { queueId: email.id },
          data: {
            status: 'sent',
            provider: provider.name,
            providerMessageId: result.id,
            sentAt: new Date(),
            errorMessage: null,
          },
        });

        if (!isCritical) {
          if (providerConfig) {
            await this.providerConfigService.incrementUsage(providerConfig.id);
            usage = await this.providerConfigService.getCurrentUsage(providerConfig.id);
          } else {
            await this.rateLimiter.incrementDailyCount();
            legacyRemaining--;
          }
        }

        sent++;
        this.logger.log(`Sent email ${email.id} to ${email.toEmail} (${provider.name} id=${result.id})`);

        await this.sleep(SEND_DELAY_MS);
      } catch (e) {
        const usingResend = provider.name === 'resend';
        if (usingResend && e instanceof ResendRateLimitError) {
          this.logger.warn('Resend rate limit hit, pausing processor');
          await this.db.emailQueue.update({
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
          const backoffMinutes = Math.pow(5, attempts - 1);
          nextRetryAt = new Date(Date.now() + backoffMinutes * 60_000);
          this.logger.warn(
            `Email ${email.id} failed (attempt ${attempts}), retry at ${nextRetryAt.toISOString()}: ${errorMsg}`,
          );
        } else {
          this.logger.error(
            `Email ${email.id} permanently failed after ${attempts} attempts: ${errorMsg}`,
          );
        }

        await this.db.emailQueue.update({
          where: { id: email.id },
          data: {
            status: 'FAILED',
            attempts,
            lastError: errorMsg,
            nextRetryAt,
            updatedAt: new Date(),
          },
        });

        await this.db.emailLog.updateMany({
          where: { queueId: email.id },
          data: {
            status: attempts < maxAttempts ? 'queued' : 'failed',
            errorMessage: errorMsg,
            provider: provider.name,
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

    await this.db.emailQueue.update({
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
