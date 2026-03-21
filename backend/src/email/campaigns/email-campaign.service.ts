import { Injectable, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email.service';
import { EmailPriority } from '../constants';
import { TransactionalEmailService } from '../transactional-email.service';
import {
  AudienceScope,
  buildVerifiedUserWhere,
  personalizeEmail,
} from '../audience/email-audience.builder';

const MAX_RECIPIENTS = 2000;
const DEFAULT_MAX_SCHEDULED_PER_TICK = 5;

export type CampaignScope = AudienceScope;

@Injectable()
export class EmailCampaignService {
  private readonly logger = new Logger(EmailCampaignService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly transactionalEmail: TransactionalEmailService,
  ) {}

  private assertFutureScheduledAt(iso: string): Date {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException('Invalid scheduledAt');
    }
    if (d.getTime() <= Date.now()) {
      throw new BadRequestException('scheduledAt must be in the future');
    }
    return d;
  }

  async createPlatformCampaign(
    createdById: string,
    dto: { subject: string; bodyHtml: string; targetFilter?: Record<string, unknown>; scheduledAt?: string },
  ) {
    let scheduledAt: Date | null = null;
    let status: 'draft' | 'scheduled' = 'draft';
    if (dto.scheduledAt) {
      scheduledAt = this.assertFutureScheduledAt(dto.scheduledAt);
      status = 'scheduled';
    }
    return this.prisma.emailCampaign.create({
      data: {
        subject: dto.subject,
        bodyHtml: dto.bodyHtml,
        senderRole: 'super_admin',
        tenantId: null,
        targetFilter: (dto.targetFilter ?? {}) as Prisma.InputJsonValue,
        status,
        scheduledAt,
        createdById,
      },
    });
  }

  async createTenantCampaign(
    tenantId: string,
    createdById: string,
    dto: { subject: string; bodyHtml: string; targetFilter?: Record<string, unknown>; scheduledAt?: string },
  ) {
    let scheduledAt: Date | null = null;
    let status: 'draft' | 'scheduled' = 'draft';
    if (dto.scheduledAt) {
      scheduledAt = this.assertFutureScheduledAt(dto.scheduledAt);
      status = 'scheduled';
    }
    return this.prisma.emailCampaign.create({
      data: {
        subject: dto.subject,
        bodyHtml: dto.bodyHtml,
        senderRole: 'company_admin',
        tenantId,
        targetFilter: (dto.targetFilter ?? {}) as Prisma.InputJsonValue,
        status,
        scheduledAt,
        createdById,
      },
    });
  }

  async setSchedulePlatform(campaignId: string, scheduledAtIso: string) {
    const scheduledAt = this.assertFutureScheduledAt(scheduledAtIso);
    const c = await this.getOneForPlatform(campaignId);
    if (c.status !== 'draft' && c.status !== 'scheduled') {
      throw new BadRequestException('Only draft or scheduled campaigns can be scheduled');
    }
    return this.prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { status: 'scheduled', scheduledAt, updatedAt: new Date() },
    });
  }

  async cancelSchedulePlatform(campaignId: string) {
    const c = await this.getOneForPlatform(campaignId);
    if (c.status !== 'scheduled') {
      throw new BadRequestException('Campaign is not scheduled');
    }
    return this.prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { status: 'draft', scheduledAt: null, updatedAt: new Date() },
    });
  }

  async setScheduleTenant(campaignId: string, tenantId: string, scheduledAtIso: string) {
    const scheduledAt = this.assertFutureScheduledAt(scheduledAtIso);
    const c = await this.getOneForTenant(campaignId, tenantId);
    if (c.status !== 'draft' && c.status !== 'scheduled') {
      throw new BadRequestException('Only draft or scheduled campaigns can be scheduled');
    }
    return this.prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { status: 'scheduled', scheduledAt, updatedAt: new Date() },
    });
  }

  async cancelScheduleTenant(campaignId: string, tenantId: string) {
    const c = await this.getOneForTenant(campaignId, tenantId);
    if (c.status !== 'scheduled') {
      throw new BadRequestException('Campaign is not scheduled');
    }
    return this.prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { status: 'draft', scheduledAt: null, updatedAt: new Date() },
    });
  }

  async listPlatformCampaigns() {
    return this.prisma.emailCampaign.findMany({
      where: { tenantId: null },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async listTenantCampaigns(tenantId: string) {
    return this.prisma.emailCampaign.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getOneForPlatform(id: string) {
    const c = await this.prisma.emailCampaign.findFirst({ where: { id, tenantId: null } });
    if (!c) throw new NotFoundException('Campaign not found');
    return c;
  }

  async getOneForTenant(id: string, tenantId: string) {
    const c = await this.prisma.emailCampaign.findFirst({ where: { id, tenantId } });
    if (!c) throw new NotFoundException('Campaign not found');
    return c;
  }

  async sendPlatformCampaign(campaignId: string) {
    const campaign = await this.getOneForPlatform(campaignId);
    if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
      throw new BadRequestException('Campaign already sent or not sendable');
    }
    const filter = (campaign.targetFilter ?? {}) as Record<string, unknown>;
    const where = buildVerifiedUserWhere('platform', null, filter);
    return this.dispatchCampaign(campaign, where);
  }

  async sendTenantCampaign(campaignId: string, tenantId: string) {
    const campaign = await this.getOneForTenant(campaignId, tenantId);
    if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
      throw new BadRequestException('Campaign already sent or not sendable');
    }
    const where = buildVerifiedUserWhere('tenant', tenantId, campaign.targetFilter as Record<string, unknown>);
    return this.dispatchCampaign(campaign, where);
  }

  /**
   * Cron: pick campaigns with status `scheduled` and `scheduledAt <= now`, claim, enqueue.
   */
  async processDueScheduledCampaigns(maxPerTick = DEFAULT_MAX_SCHEDULED_PER_TICK): Promise<void> {
    for (let i = 0; i < maxPerTick; i++) {
      const processed = await this.processOneDueScheduledCampaign();
      if (!processed) break;
    }
  }

  private async processOneDueScheduledCampaign(): Promise<boolean> {
    const now = new Date();
    const due = await this.prisma.emailCampaign.findFirst({
      where: { status: 'scheduled', scheduledAt: { lte: now } },
      orderBy: { scheduledAt: 'asc' },
    });
    if (!due) return false;

    const claimed = await this.prisma.emailCampaign.updateMany({
      where: { id: due.id, status: 'scheduled' },
      data: { status: 'sending', updatedAt: new Date() },
    });
    if (claimed.count === 0) return false;

    const scope: CampaignScope = due.tenantId ? 'tenant' : 'platform';
    let where: Prisma.UserWhereInput;
    try {
      where = buildVerifiedUserWhere(scope, due.tenantId, due.targetFilter as Record<string, unknown>);
    } catch (err) {
      this.logger.error(`Campaign ${due.id} invalid target filter`, err instanceof Error ? err.stack : err);
      await this.prisma.emailCampaign.update({
        where: { id: due.id },
        data: { status: 'failed', updatedAt: new Date() },
      });
      return true;
    }

    try {
      await this.dispatchQueuedRecipients(due, where);
      return true;
    } catch (err) {
      this.logger.error(`Campaign ${due.id} dispatch failed`, err instanceof Error ? err.stack : err);
      await this.prisma.emailCampaign.update({
        where: { id: due.id },
        data: { status: 'failed', updatedAt: new Date() },
      });
      return true;
    }
  }

  private async dispatchCampaign(
    campaign: { id: string; subject: string; bodyHtml: string },
    where: Prisma.UserWhereInput,
  ) {
    await this.prisma.emailCampaign.update({
      where: { id: campaign.id },
      data: { status: 'sending', updatedAt: new Date() },
    });

    try {
      return await this.dispatchQueuedRecipients(campaign, where);
    } catch (err) {
      this.logger.error(`Campaign ${campaign.id} dispatch failed`, err instanceof Error ? err.stack : err);
      await this.prisma.emailCampaign.update({
        where: { id: campaign.id },
        data: { status: 'failed', updatedAt: new Date() },
      });
      throw err;
    }
  }

  private async dispatchQueuedRecipients(
    campaign: { id: string; subject: string; bodyHtml: string },
    where: Prisma.UserWhereInput,
  ) {
    const users = await this.prisma.user.findMany({
      where,
      select: { id: true, email: true, name: true },
      take: MAX_RECIPIENTS,
    });

    let sent = 0;
    let failed = 0;

    for (const u of users) {
      if (u.id && !(await this.transactionalEmail.canSend(u.id, 'admin_campaign'))) {
        continue;
      }
      const subject = personalizeEmail(campaign.subject, u.name);
      const html = personalizeEmail(campaign.bodyHtml, u.name);
      const idempotencyKey = `campaign:${campaign.id}:${u.id}`;
      const queueId = await this.emailService.enqueue({
        toEmail: u.email,
        toName: u.name,
        subject,
        htmlBody: html,
        emailType: 'marketing',
        eventType: 'admin_campaign',
        priority: EmailPriority.LOW,
        triggeredBy: `campaign:${campaign.id}`,
        userId: u.id,
        idempotencyKey,
        metadata: { campaignId: campaign.id },
      });
      if (queueId) sent++;
      else failed++;
    }

    await this.prisma.emailCampaign.update({
      where: { id: campaign.id },
      data: {
        status: 'sent',
        sentAt: new Date(),
        scheduledAt: null,
        totalRecipients: users.length,
        sentCount: sent,
        failedCount: failed,
        updatedAt: new Date(),
      },
    });

    this.logger.log(`Campaign ${campaign.id}: queued ${sent}, failed enqueue ${failed}, recipients ${users.length}`);
    return { campaignId: campaign.id, recipients: users.length, queued: sent, failed };
  }
}
