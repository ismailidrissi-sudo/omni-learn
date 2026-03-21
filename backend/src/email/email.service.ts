import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailPriority, PRIORITY_TO_ENUM } from './constants';
import { BrandingResolverService } from './templates/branding-resolver.service';
import { TemplateEngineService } from './templates/template-engine.service';
import { TemplateLoaderService } from './templates/template-loader.service';

type EmailPriorityLevel = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
type EmailStatus = 'PENDING' | 'SENDING' | 'SENT' | 'FAILED' | 'SCHEDULED' | 'CANCELLED';

export interface EnqueueParams {
  toEmail: string;
  subject: string;
  htmlBody: string;
  toName?: string;
  fromEmail?: string;
  fromName?: string;
  replyTo?: string;
  textBody?: string;
  emailType?: string;
  /** Transactional event key for auditing and idempotency (e.g. password_reset_request) */
  eventType?: string;
  priority?: number;
  scheduledFor?: Date;
  /** Defer processing until this time (rate-limit overflow) */
  scheduledAfter?: Date;
  triggeredBy?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  /** Unique per logical send — duplicate queue + audit rows are skipped */
  idempotencyKey?: string;
  templateSlug?: string;
  language?: string;
  /** Snapshot written to email_logs (optional; can be filled by branding resolver upstream) */
  brandingSnapshot?: Record<string, unknown>;
}

export interface EnqueueFromTemplateParams {
  toEmail: string;
  templateSlug: string;
  variables: Record<string, string>;
  language?: string;
  tenantId?: string | null;
  toName?: string;
  priority?: number;
  triggeredBy?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
  scheduledFor?: Date;
  scheduledAfter?: Date;
}

/**
 * THE ONLY WAY TO SEND EMAIL IN OMNILEARN.
 *
 * Every module (auth, courses, notifications, certificates, marketing)
 * MUST call enqueue() instead of sending directly.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  private readonly db: any;
  constructor(
    private readonly prisma: PrismaService,
    private readonly brandingResolver: BrandingResolverService,
    private readonly templateLoader: TemplateLoaderService,
    private readonly templateEngine: TemplateEngineService,
  ) {
    this.db = prisma as any;
  }

  async enqueue(params: EnqueueParams): Promise<string> {
    const priority = params.priority ?? EmailPriority.NORMAL;
    const priorityEnum = (PRIORITY_TO_ENUM as Record<number, string>)[priority] as EmailPriorityLevel;
    const now = new Date();

    if (params.idempotencyKey) {
      const alreadySent = await this.db.emailLog.findFirst({
        where: {
          idempotencyKey: params.idempotencyKey,
          status: { in: ['sent', 'delivered'] },
        },
      });
      if (alreadySent) {
        this.logger.log(`Idempotent skip (already sent): ${params.idempotencyKey}`);
        return alreadySent.queueId || '';
      }

      const inFlight = await this.db.emailQueue.findFirst({
        where: {
          idempotencyKey: params.idempotencyKey,
          status: { in: ['PENDING', 'SCHEDULED', 'SENDING'] },
        },
      });
      if (inFlight) {
        this.logger.log(`Idempotent skip (queue in flight): ${params.idempotencyKey}`);
        return inFlight.id;
      }
    }

    const dayBucket = new Date(
      (params.scheduledFor && params.scheduledFor > now ? params.scheduledFor : now).toISOString().split('T')[0],
    );

    let status: EmailStatus = 'PENDING';
    if (params.scheduledFor && params.scheduledFor > now) {
      status = 'SCHEDULED';
    }

    try {
      const entry = await this.prisma.$transaction(async (tx) => {
        const q = await tx.emailQueue.create({
          data: {
            toEmail: params.toEmail,
            toName: params.toName,
            fromEmail: params.fromEmail,
            fromName: params.fromName,
            replyTo: params.replyTo,
            subject: params.subject,
            htmlBody: params.htmlBody,
            textBody: params.textBody,
            emailType: params.emailType || 'transactional',
            priority: priorityEnum,
            status,
            scheduledFor: params.scheduledFor,
            scheduledAfter: params.scheduledAfter,
            dayBucket,
            triggeredBy: params.triggeredBy,
            userId: params.userId,
            idempotencyKey: params.idempotencyKey,
            eventType: params.eventType || params.emailType,
            metadata: (params.metadata as Prisma.InputJsonValue) ?? {},
          },
        });

        await tx.emailLog.create({
          data: {
            queueId: q.id,
            recipientEmail: params.toEmail,
            recipientUserId: params.userId,
            eventType: params.eventType || params.emailType || 'transactional',
            templateSlug: params.templateSlug,
            templateLanguage: params.language || 'en',
            subject: params.subject,
            language: params.language || 'en',
            brandingSnapshot: params.brandingSnapshot
              ? (params.brandingSnapshot as Prisma.InputJsonValue)
              : undefined,
            provider: process.env.EMAIL_TRANSPORT === 'smtp' ? 'smtp' : 'resend',
            status: 'queued',
            idempotencyKey: params.idempotencyKey,
            metadata: params.metadata
              ? (params.metadata as Prisma.InputJsonValue)
              : undefined,
          },
        });

        return q;
      });

      this.logger.log(
        `Email enqueued: id=${entry.id} to=${params.toEmail} type=${params.emailType} priority=${priorityEnum}`,
      );

      return entry.id;
    } catch (error) {
      this.logger.error(
        `Failed to enqueue email to=${params.toEmail} type=${params.emailType}: ${error}`,
      );
      return '';
    }
  }

  async enqueueFromTemplate(params: EnqueueFromTemplateParams): Promise<string> {
    const language = params.language || 'en';
    const template = await this.templateLoader.loadActive(params.templateSlug, language);
    const branding = await this.brandingResolver.resolveForTenant(params.tenantId ?? null, { language });

    const rendered = this.templateEngine.render(
      template.subjectTemplate,
      template.htmlTemplate,
      template.textTemplate,
      params.variables,
      branding,
    );

    const eventType = template.eventType || params.templateSlug;

    return this.enqueue({
      toEmail: params.toEmail,
      toName: params.toName,
      subject: rendered.subject,
      htmlBody: rendered.htmlBody,
      textBody: rendered.textBody || undefined,
      emailType: params.templateSlug,
      eventType,
      priority: params.priority,
      triggeredBy: params.triggeredBy,
      userId: params.userId,
      metadata: params.metadata,
      idempotencyKey: params.idempotencyKey,
      scheduledFor: params.scheduledFor,
      scheduledAfter: params.scheduledAfter,
      templateSlug: template.slug,
      language: template.language,
      brandingSnapshot: { ...branding, templateVersion: template.version },
    });
  }
}
