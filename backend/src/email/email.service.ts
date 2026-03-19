import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailPriority, PRIORITY_TO_ENUM } from './constants';

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
  priority?: number;
  scheduledFor?: Date;
  triggeredBy?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface EnqueueFromTemplateParams {
  toEmail: string;
  templateSlug: string;
  variables: Record<string, string>;
  toName?: string;
  priority?: number;
  triggeredBy?: string;
  userId?: string;
  metadata?: Record<string, any>;
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
  constructor(private readonly prisma: PrismaService) {
    this.db = prisma as any;
  }

  async enqueue(params: EnqueueParams): Promise<string> {
    const priority = params.priority ?? EmailPriority.NORMAL;
    const priorityEnum = (PRIORITY_TO_ENUM as Record<number, string>)[priority] as EmailPriorityLevel;
    const now = new Date();

    const dayBucket = new Date(
      (params.scheduledFor && params.scheduledFor > now
        ? params.scheduledFor
        : now
      )
        .toISOString()
        .split('T')[0],
    );

    let status: EmailStatus = 'PENDING';
    if (params.scheduledFor && params.scheduledFor > now) {
      status = 'SCHEDULED';
    }

    const entry = await this.db.emailQueue.create({
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
        dayBucket,
        triggeredBy: params.triggeredBy,
        userId: params.userId,
        metadata: params.metadata || {},
      },
    });

    this.logger.log(
      `Email enqueued: id=${entry.id} to=${params.toEmail} type=${params.emailType} priority=${priorityEnum}`,
    );

    return entry.id;
  }

  async enqueueFromTemplate(params: EnqueueFromTemplateParams): Promise<string> {
    const template = await this.db.emailTemplate.findUnique({
      where: { slug: params.templateSlug },
    });

    if (!template) {
      throw new Error(`Email template '${params.templateSlug}' not found`);
    }
    if (!template.isActive) {
      throw new Error(`Email template '${params.templateSlug}' is disabled`);
    }

    let subject = template.subjectTemplate;
    let html = template.htmlTemplate;
    let text = template.textTemplate;

    for (const [key, value] of Object.entries(params.variables)) {
      const placeholder = `{{${key}}}`;
      subject = subject.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
      html = html.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
      if (text) {
        text = text.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
      }
    }

    return this.enqueue({
      toEmail: params.toEmail,
      toName: params.toName,
      subject,
      htmlBody: html,
      textBody: text || undefined,
      emailType: params.templateSlug,
      priority: params.priority,
      triggeredBy: params.triggeredBy,
      userId: params.userId,
      metadata: params.metadata,
    });
  }
}
