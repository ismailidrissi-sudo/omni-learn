import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CronExpressionParser } from 'cron-parser';
import { PrismaService } from '../../prisma/prisma.service';
import { buildVerifiedUserWhere, personalizeEmail, AudienceScope } from '../audience/email-audience.builder';
import { EmailService } from '../email.service';
import { EmailPriority } from '../constants';
import { TransactionalEmailService } from '../transactional-email.service';

const MAX_RECIPIENTS = 2000;
const DEFAULT_MAX_PER_TICK = 5;

/** HTML subject/body in `targetAudience` JSON. */
export const CUSTOM_BROADCAST_EVENT = 'custom_broadcast';
/** DB `email_templates.slug` + `variables`; uses {@link EmailService.enqueueFromTemplate}. */
export const TEMPLATE_BROADCAST_EVENT = 'template_broadcast';

function getNextCronAfter(expression: string, afterFire: Date): Date {
  const iter = CronExpressionParser.parse(expression, {
    currentDate: new Date(afterFire.getTime() + 1),
    tz: 'UTC',
  });
  return iter.next().toDate();
}

function getFirstCronFire(expression: string, from: Date): Date {
  const iter = CronExpressionParser.parse(expression, { currentDate: from, tz: 'UTC' });
  return iter.next().toDate();
}

@Injectable()
export class EmailScheduleService {
  private readonly logger = new Logger(EmailScheduleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly transactionalEmail: TransactionalEmailService,
  ) {}

  private assertFutureRunAt(iso: string): Date {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException('Invalid nextRunAt');
    }
    if (d.getTime() <= Date.now()) {
      throw new BadRequestException('nextRunAt must be in the future');
    }
    return d;
  }

  /**
   * Validates audience filters (excluding subject/body/template fields) for the given schedule tenant scope.
   */
  private validateAudienceFilters(scheduleTenantId: string | null, filter: Record<string, unknown>) {
    const scope: AudienceScope = scheduleTenantId ? 'tenant' : 'platform';
    buildVerifiedUserWhere(scope, scheduleTenantId, filter);
  }

  private mergeTargetAudienceForEvent(
    eventType: string,
    dto: {
      subject?: string;
      bodyHtml?: string;
      templateSlug?: string;
      variables?: Record<string, string>;
      audience?: { all?: boolean; tenantId?: string; userType?: string };
    },
  ): Prisma.InputJsonValue {
    const base = { ...(dto.audience ?? {}) } as Record<string, unknown>;
    if (eventType === CUSTOM_BROADCAST_EVENT) {
      return {
        subject: dto.subject!,
        bodyHtml: dto.bodyHtml!,
        ...base,
      } as Prisma.InputJsonValue;
    }
    return {
      templateSlug: dto.templateSlug!.trim(),
      variables: dto.variables ?? {},
      ...base,
    } as Prisma.InputJsonValue;
  }

  private parseBroadcastPayload(ta: Record<string, unknown>) {
    const subject = ta.subject;
    const bodyHtml = ta.bodyHtml;
    if (typeof subject !== 'string' || !subject.trim()) {
      throw new BadRequestException('Schedule targetAudience.subject is missing');
    }
    if (typeof bodyHtml !== 'string' || !bodyHtml.trim()) {
      throw new BadRequestException('Schedule targetAudience.bodyHtml is missing');
    }
    const filter: Record<string, unknown> = { ...ta };
    delete filter.subject;
    delete filter.bodyHtml;
    return { subject, bodyHtml, filter };
  }

  private parseTemplatePayload(ta: Record<string, unknown>) {
    const templateSlug = ta.templateSlug;
    if (typeof templateSlug !== 'string' || !templateSlug.trim()) {
      throw new BadRequestException('Schedule targetAudience.templateSlug is missing');
    }
    const variables =
      ta.variables && typeof ta.variables === 'object' && !Array.isArray(ta.variables)
        ? (ta.variables as Record<string, string>)
        : {};
    const filter: Record<string, unknown> = { ...ta };
    delete filter.templateSlug;
    delete filter.variables;
    return { templateSlug: templateSlug.trim(), variables, filter };
  }

  private resolveCreateInputs(dto: {
    scheduleType: 'once' | 'cron';
    nextRunAt?: string;
    cronExpression?: string;
    subject?: string;
    bodyHtml?: string;
    templateSlug?: string;
    variables?: Record<string, string>;
    audience?: { all?: boolean; tenantId?: string; userType?: string };
    emailEventType?: string;
  }) {
    const eventType = dto.emailEventType?.trim() || CUSTOM_BROADCAST_EVENT;
    if (eventType === CUSTOM_BROADCAST_EVENT) {
      if (!dto.subject?.trim() || !dto.bodyHtml?.trim()) {
        throw new BadRequestException('subject and bodyHtml are required for custom_broadcast');
      }
    } else if (eventType === TEMPLATE_BROADCAST_EVENT) {
      if (!dto.templateSlug?.trim()) {
        throw new BadRequestException('templateSlug is required for template_broadcast');
      }
    } else {
      throw new BadRequestException(`Unsupported emailEventType: ${eventType}`);
    }

    let nextRunAt: Date;
    if (dto.scheduleType === 'cron') {
      const expr = dto.cronExpression?.trim();
      if (!expr) {
        throw new BadRequestException('cronExpression is required for cron schedules');
      }
      try {
        CronExpressionParser.parse(expr, { tz: 'UTC', currentDate: new Date() });
      } catch {
        throw new BadRequestException('Invalid cronExpression');
      }
      if (dto.nextRunAt) {
        nextRunAt = this.assertFutureRunAt(dto.nextRunAt);
      } else {
        nextRunAt = getFirstCronFire(expr, new Date());
        if (nextRunAt.getTime() <= Date.now()) {
          nextRunAt = getFirstCronFire(expr, new Date(Date.now() + 2000));
        }
      }
    } else {
      if (!dto.nextRunAt) {
        throw new BadRequestException('nextRunAt is required for once schedules');
      }
      nextRunAt = this.assertFutureRunAt(dto.nextRunAt);
    }

    return { eventType, nextRunAt };
  }

  async createPlatform(
    createdById: string,
    dto: Parameters<EmailScheduleService['resolveCreateInputs']>[0] & {
      name: string;
      description?: string;
      tenantId?: string;
    },
  ) {
    const scheduleTenantId = dto.tenantId ?? null;
    const { eventType, nextRunAt } = this.resolveCreateInputs(dto);
    this.validateAudienceFilters(scheduleTenantId, (dto.audience ?? {}) as Record<string, unknown>);

    return this.prisma.emailSchedule.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        scheduleType: dto.scheduleType,
        cronExpression: dto.scheduleType === 'cron' ? dto.cronExpression!.trim() : null,
        targetAudience: this.mergeTargetAudienceForEvent(eventType, dto),
        emailEventType: eventType,
        nextRunAt,
        tenantId: scheduleTenantId,
        createdById,
        isActive: true,
      },
    });
  }

  async createForTenant(
    tenantId: string,
    createdById: string,
    dto: Parameters<EmailScheduleService['resolveCreateInputs']>[0] & {
      name: string;
      description?: string;
    },
  ) {
    const { eventType, nextRunAt } = this.resolveCreateInputs(dto);
    this.validateAudienceFilters(tenantId, (dto.audience ?? {}) as Record<string, unknown>);

    return this.prisma.emailSchedule.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        scheduleType: dto.scheduleType,
        cronExpression: dto.scheduleType === 'cron' ? dto.cronExpression!.trim() : null,
        targetAudience: this.mergeTargetAudienceForEvent(eventType, dto),
        emailEventType: eventType,
        nextRunAt,
        tenantId,
        createdById,
        isActive: true,
      },
    });
  }

  async listPlatform() {
    return this.prisma.emailSchedule.findMany({
      where: { tenantId: null },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async listTenant(tenantId: string) {
    return this.prisma.emailSchedule.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getForPlatform(id: string) {
    const row = await this.prisma.emailSchedule.findFirst({ where: { id, tenantId: null } });
    if (!row) throw new NotFoundException('Schedule not found');
    return row;
  }

  async getForTenant(id: string, tenantId: string) {
    const row = await this.prisma.emailSchedule.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Schedule not found');
    return row;
  }

  async updatePlatform(id: string, dto: { name?: string; description?: string; nextRunAt?: string; isActive?: boolean }) {
    await this.getForPlatform(id);
    if (dto.nextRunAt !== undefined) {
      this.assertFutureRunAt(dto.nextRunAt);
    }
    return this.prisma.emailSchedule.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.nextRunAt !== undefined && { nextRunAt: new Date(dto.nextRunAt) }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        updatedAt: new Date(),
      },
    });
  }

  async updateTenant(id: string, tenantId: string, dto: { name?: string; description?: string; nextRunAt?: string; isActive?: boolean }) {
    await this.getForTenant(id, tenantId);
    if (dto.nextRunAt !== undefined) {
      this.assertFutureRunAt(dto.nextRunAt);
    }
    return this.prisma.emailSchedule.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.nextRunAt !== undefined && { nextRunAt: new Date(dto.nextRunAt) }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        updatedAt: new Date(),
      },
    });
  }

  async deletePlatform(id: string) {
    await this.getForPlatform(id);
    await this.prisma.emailSchedule.delete({ where: { id } });
    return { deleted: true };
  }

  async deleteTenant(id: string, tenantId: string) {
    await this.getForTenant(id, tenantId);
    await this.prisma.emailSchedule.delete({ where: { id } });
    return { deleted: true };
  }

  /** Cron: schedules whose `nextRunAt` has passed (`once` or `cron`). */
  async processDueEmailSchedules(maxPerTick = DEFAULT_MAX_PER_TICK): Promise<void> {
    for (let i = 0; i < maxPerTick; i++) {
      const ran = await this.processOneDueSchedule();
      if (!ran) break;
    }
  }

  private async processOneDueSchedule(): Promise<boolean> {
    const now = new Date();
    const due = await this.prisma.emailSchedule.findFirst({
      where: {
        isActive: true,
        nextRunAt: { lte: now },
      },
      orderBy: { nextRunAt: 'asc' },
    });
    if (!due) return false;

    const isOnce = due.scheduleType === 'once';
    const isCron = due.scheduleType === 'cron';

    let claimData: Prisma.EmailScheduleUpdateManyMutationInput;

    if (isOnce) {
      claimData = { nextRunAt: null, updatedAt: now };
    } else if (isCron) {
      if (!due.cronExpression) {
        await this.prisma.emailSchedule.update({
          where: { id: due.id },
          data: { isActive: false, updatedAt: now },
        });
        return true;
      }
      let nextAt: Date;
      try {
        nextAt = getNextCronAfter(due.cronExpression, due.nextRunAt!);
      } catch (err) {
        this.logger.error(`Invalid cron on schedule ${due.id}`, err);
        await this.prisma.emailSchedule.update({
          where: { id: due.id },
          data: { isActive: false, updatedAt: now },
        });
        return true;
      }
      claimData = { nextRunAt: nextAt, lastRunAt: now, updatedAt: now };
    } else {
      return false;
    }

    const claimed = await this.prisma.emailSchedule.updateMany({
      where: { id: due.id, isActive: true, nextRunAt: due.nextRunAt },
      data: claimData,
    });
    if (claimed.count === 0) return false;

    try {
      if (due.emailEventType === TEMPLATE_BROADCAST_EVENT) {
        await this.dispatchTemplateBroadcast(due);
      } else if (due.emailEventType === CUSTOM_BROADCAST_EVENT) {
        await this.dispatchCustomBroadcast(due);
      } else {
        this.logger.warn(`Unsupported emailEventType ${due.emailEventType} on schedule ${due.id}, skipping send`);
      }
    } catch (err) {
      this.logger.error(`Email schedule ${due.id} failed`, err instanceof Error ? err.stack : err);
    } finally {
      if (isOnce) {
        await this.prisma.emailSchedule.update({
          where: { id: due.id },
          data: { lastRunAt: new Date(), isActive: false, updatedAt: new Date() },
        });
      }
    }

    return true;
  }

  private async dispatchCustomBroadcast(schedule: {
    id: string;
    tenantId: string | null;
    targetAudience: Prisma.JsonValue;
  }) {
    const ta = schedule.targetAudience as Record<string, unknown>;
    const { subject, bodyHtml, filter } = this.parseBroadcastPayload(ta);
    const scope: AudienceScope = schedule.tenantId ? 'tenant' : 'platform';
    const where = buildVerifiedUserWhere(scope, schedule.tenantId, filter);

    const users = await this.prisma.user.findMany({
      where,
      select: { id: true, email: true, name: true },
      take: MAX_RECIPIENTS,
    });

    let sent = 0;
    let failed = 0;
    for (const u of users) {
      if (u.id && !(await this.transactionalEmail.canSend(u.id, 'scheduled_broadcast'))) {
        continue;
      }
      const subj = personalizeEmail(subject, u.name);
      const html = personalizeEmail(bodyHtml, u.name);
      const idempotencyKey = `email_schedule:${schedule.id}:${u.id}`;
      const queueId = await this.emailService.enqueue({
        toEmail: u.email,
        toName: u.name,
        subject: subj,
        htmlBody: html,
        emailType: 'marketing',
        eventType: 'scheduled_broadcast',
        priority: EmailPriority.LOW,
        triggeredBy: `email_schedule:${schedule.id}`,
        userId: u.id,
        idempotencyKey,
        metadata: { emailScheduleId: schedule.id },
      });
      if (queueId) sent++;
      else failed++;
    }
    this.logger.log(`Email schedule ${schedule.id}: queued ${sent}, failed ${failed}, recipients ${users.length}`);
  }

  private async dispatchTemplateBroadcast(schedule: {
    id: string;
    tenantId: string | null;
    targetAudience: Prisma.JsonValue;
  }) {
    const ta = schedule.targetAudience as Record<string, unknown>;
    const { templateSlug, variables: baseVars, filter } = this.parseTemplatePayload(ta);
    const scope: AudienceScope = schedule.tenantId ? 'tenant' : 'platform';
    const where = buildVerifiedUserWhere(scope, schedule.tenantId, filter);

    const users = await this.prisma.user.findMany({
      where,
      select: { id: true, email: true, name: true },
      take: MAX_RECIPIENTS,
    });

    let sent = 0;
    let failed = 0;
    for (const u of users) {
      if (u.id && !(await this.transactionalEmail.canSend(u.id, 'scheduled_broadcast'))) {
        continue;
      }
      const vars: Record<string, string> = { ...baseVars, name: u.name || 'there' };
      const id = await this.emailService.enqueueFromTemplate({
        toEmail: u.email,
        toName: u.name || undefined,
        templateSlug,
        variables: vars,
        tenantId: schedule.tenantId ?? undefined,
        userId: u.id,
        triggeredBy: `email_schedule:${schedule.id}`,
        idempotencyKey: `email_schedule:${schedule.id}:${u.id}`,
        metadata: { emailScheduleId: schedule.id },
      });
      if (id) sent++;
      else failed++;
    }
    this.logger.log(
      `Email schedule ${schedule.id} (template ${templateSlug}): queued ${sent}, failed ${failed}, recipients ${users.length}`,
    );
  }
}
