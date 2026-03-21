import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RbacGuard } from '../auth/guards/rbac.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RbacRole } from '../constants/rbac.constant';
import { PrismaService } from '../prisma/prisma.service';
import { EmailConfigService } from './email-config.service';
import { ResendClientService } from './resend-client.service';
import { RateLimiterService } from './rate-limiter.service';
import { EmailService } from './email.service';
import { EmailPriority } from './constants';
import { encryptApiKey, decryptApiKey, maskApiKey } from './encryption.util';
import { UpdateEmailConfigDto, SendTestEmailDto } from './dto/update-email-config.dto';
import { testEmailHtml, testEmailSubject } from './templates';
import { TemplateLoaderService } from './templates/template-loader.service';
import { BrandingResolverService } from './templates/branding-resolver.service';
import { TemplateEngineService } from './templates/template-engine.service';

@Controller('admin/email')
@UseGuards(AuthGuard('jwt'), RbacGuard)
@Roles(RbacRole.SUPER_ADMIN)
export class EmailAdminController {
  private readonly db: any;
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: EmailConfigService,
    private readonly resendClient: ResendClientService,
    private readonly rateLimiter: RateLimiterService,
    private readonly emailService: EmailService,
    private readonly templateLoader: TemplateLoaderService,
    private readonly brandingResolver: BrandingResolverService,
    private readonly templateEngine: TemplateEngineService,
  ) {
    this.db = prisma as any;
  }

  @Get('config')
  async getConfig() {
    const hasConfig = await this.configService.hasConfig();
    if (!hasConfig) {
      return { configured: false };
    }

    const config = await this.configService.getConfig();
    const rawKey = decryptApiKey(config.apiKey);

    return {
      configured: true,
      provider: config.provider,
      apiKeyMasked: maskApiKey(rawKey),
      apiKeyLastFour: config.apiKeyLastFour,
      defaultFromName: config.defaultFromName,
      defaultFromEmail: config.defaultFromEmail,
      defaultReplyTo: config.defaultReplyTo,
      dailySendLimit: config.dailySendLimit,
      rateLimitPerSecond: config.rateLimitPerSecond,
      overflowStrategy: config.overflowStrategy,
      overflowSendHour: config.overflowSendHour,
      isActive: config.isActive,
      lastVerifiedAt: config.lastVerifiedAt,
      updatedAt: config.updatedAt,
    };
  }

  @Put('config')
  async updateConfig(@Body() payload: UpdateEmailConfigDto, @Req() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    const data: Record<string, any> = {};

    if (payload.apiKey !== undefined) {
      if (!payload.apiKey.startsWith('re_')) {
        throw new BadRequestException("Invalid Resend API key format. Must start with 're_'");
      }
      data.apiKey = encryptApiKey(payload.apiKey);
      data.apiKeyLastFour = payload.apiKey.slice(-5);
    }

    if (payload.defaultFromName !== undefined) data.defaultFromName = payload.defaultFromName;
    if (payload.defaultFromEmail !== undefined) data.defaultFromEmail = payload.defaultFromEmail;
    if (payload.defaultReplyTo !== undefined) data.defaultReplyTo = payload.defaultReplyTo || null;
    if (payload.dailySendLimit !== undefined) data.dailySendLimit = payload.dailySendLimit;
    if (payload.overflowSendHour !== undefined) data.overflowSendHour = payload.overflowSendHour;
    if (payload.isActive !== undefined) data.isActive = payload.isActive;

    if (payload.overflowStrategy !== undefined) {
      const valid = ['SCHEDULE_NEXT_DAY', 'DROP', 'QUEUE_HOLD'];
      if (!valid.includes(payload.overflowStrategy)) {
        throw new BadRequestException(`overflowStrategy must be one of: ${valid.join(', ')}`);
      }
      data.overflowStrategy = payload.overflowStrategy;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields to update');
    }

    data.updatedBy = userId;

    const hasConfig = await this.configService.hasConfig();

    if (hasConfig) {
      const existing = await this.configService.getConfig();
      await this.db.emailConfig.update({
        where: { id: existing.id },
        data,
      });
    } else {
      if (!data.apiKey) {
        throw new BadRequestException('API key is required for initial configuration');
      }
      await this.db.emailConfig.create({
        data: {
          apiKey: data.apiKey,
          apiKeyLastFour: data.apiKeyLastFour,
          defaultFromName: data.defaultFromName || 'OmniLearn',
          defaultFromEmail: data.defaultFromEmail || 'noreply@omnilearn.space',
          defaultReplyTo: data.defaultReplyTo,
          dailySendLimit: data.dailySendLimit || 100,
          overflowSendHour: data.overflowSendHour ?? 6,
          isActive: data.isActive ?? true,
          updatedBy: userId,
        },
      });
    }

    this.configService.invalidateCache();
    return { status: 'updated' };
  }

  @Post('test-connection')
  async testConnection() {
    const hasConfig = await this.configService.hasConfig();
    if (!hasConfig) {
      return { status: 'failed', error: 'No email configuration found' };
    }

    try {
      const result = await this.resendClient.verifyKey();
      if (result.valid) {
        const config = await this.configService.getConfig();
        await this.db.emailConfig.update({
          where: { id: config.id },
          data: { lastVerifiedAt: new Date() },
        });
        this.configService.invalidateCache();

        return {
          status: 'connected',
          domains: result.domains,
          verifiedAt: new Date().toISOString(),
        };
      }
      return { status: 'failed', error: result.error };
    } catch (e) {
      return { status: 'error', error: e instanceof Error ? e.message : String(e) };
    }
  }

  @Get('templates/preview')
  async previewEmailTemplate(
    @Query('slug') slug: string,
    @Query('language') language = 'en',
    @Query('tenantId') tenantId?: string,
  ) {
    if (!slug?.trim()) {
      throw new BadRequestException('slug is required');
    }
    const template = await this.templateLoader.loadActive(slug.trim(), language || 'en');
    const branding = await this.brandingResolver.resolveForTenant(tenantId?.trim() || null, {
      language: language || 'en',
    });
    const rendered = this.templateEngine.render(
      template.subjectTemplate,
      template.htmlTemplate,
      template.textTemplate,
      {},
      branding,
    );
    return {
      subject: rendered.subject,
      html: rendered.htmlBody,
      text: rendered.textBody,
      variables: template.variables,
    };
  }

  @Get('templates')
  async listEmailTemplates() {
    return this.db.emailTemplate.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        language: true,
        eventType: true,
        version: true,
        isActive: true,
      },
      orderBy: [{ slug: 'asc' }, { language: 'asc' }, { version: 'desc' }],
    });
  }

  @Post('send-test')
  async sendTestEmail(@Body() payload: SendTestEmailDto) {
    const queueId = await this.emailService.enqueue({
      toEmail: payload.toEmail,
      subject: testEmailSubject(),
      htmlBody: testEmailHtml(),
      emailType: 'test',
      priority: EmailPriority.CRITICAL,
      triggeredBy: 'admin_test',
    });

    return { status: 'queued', queueId };
  }

  @Get('stats/today')
  async getTodayStats() {
    let dailyLimit = 100;
    try {
      const config = await this.configService.getConfig();
      dailyLimit = config.dailySendLimit;
    } catch {}

    const todayStr = new Date().toISOString().split('T')[0];
    const todayDate = new Date(todayStr);

    const stats = await this.db.emailDailyStats.findUnique({
      where: { dayBucket: todayDate },
    });

    const pending = await this.db.emailQueue.count({
      where: {
        status: { in: ['PENDING', 'SCHEDULED'] },
        dayBucket: todayDate,
      },
    });

    const sentToday = stats?.sentCount ?? 0;

    return {
      dailyLimit,
      sentToday,
      remainingToday: Math.max(0, dailyLimit - sentToday),
      failedToday: stats?.failedCount ?? 0,
      overflowedToday: stats?.scheduledOverflowCount ?? 0,
      pendingInQueue: pending,
      usagePercentage:
        dailyLimit > 0 ? Math.round((sentToday / dailyLimit) * 1000) / 10 : 0,
    };
  }

  @Get('stats/history')
  async getStatsHistory(@Query('days') days?: number) {
    const daysCount = days || 30;
    const since = new Date();
    since.setDate(since.getDate() - daysCount);
    const sinceStr = since.toISOString().split('T')[0];

    const rows = await this.db.emailDailyStats.findMany({
      where: { dayBucket: { gte: new Date(sinceStr) } },
      orderBy: { dayBucket: 'asc' },
    });

    return rows.map((r: any) => ({
      dayBucket: r.dayBucket.toISOString().split('T')[0],
      sentCount: r.sentCount,
      failedCount: r.failedCount,
      scheduledOverflowCount: r.scheduledOverflowCount,
    }));
  }

  @Get('dashboard')
  async getDashboard() {
    const now = Date.now();
    const since24h = new Date(now - 24 * 60 * 60 * 1000);
    const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const since30d = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const [stats24h, stats7d, stats30d, lastOk, lastErr] = await Promise.all([
      this.aggregateEmailLogStats(since24h),
      this.aggregateEmailLogStats(since7d),
      this.aggregateEmailLogStats(since30d),
      this.db.emailLog.findFirst({
        where: { sentAt: { not: null }, status: { in: ['sent', 'delivered'] } },
        orderBy: { sentAt: 'desc' },
        select: { sentAt: true },
      }),
      this.db.emailLog.findFirst({
        where: {
          OR: [{ status: 'failed' }, { errorMessage: { not: null } }],
        },
        orderBy: { createdAt: 'desc' },
        select: { errorMessage: true, createdAt: true },
      }),
    ]);

    const denom = stats24h.delivered + stats24h.failed + stats24h.bounced;
    const deliveryRate24h =
      denom > 0 ? Math.round((stats24h.delivered / denom) * 10000) / 100 : 0;
    const bounceRate24h =
      stats24h.total > 0
        ? Math.round((stats24h.bounced / stats24h.total) * 10000) / 100
        : 0;

    return {
      stats24h,
      stats7d,
      stats30d,
      deliveryRate24h,
      bounceRate24h,
      lastSuccessfulSend: lastOk?.sentAt ?? null,
      lastError: lastErr
        ? {
            message: lastErr.errorMessage?.trim() || 'Delivery failed',
            at: lastErr.createdAt,
          }
        : null,
    };
  }

  @Get('dashboard/queue')
  async getDashboardQueue() {
    const [queued, sending, scheduled, failed, total] = await Promise.all([
      this.db.emailQueue.count({ where: { status: 'PENDING' } }),
      this.db.emailQueue.count({ where: { status: 'SENDING' } }),
      this.db.emailQueue.count({ where: { status: 'SCHEDULED' } }),
      this.db.emailQueue.count({ where: { status: 'FAILED' } }),
      this.db.emailQueue.count(),
    ]);

    return { queued, sending, scheduled, failed, total };
  }

  private async aggregateEmailLogStats(since: Date): Promise<{
    total: number;
    delivered: number;
    failed: number;
    bounced: number;
  }> {
    const windowWhere = { createdAt: { gte: since } };
    const [total, delivered, failed, bounced] = await Promise.all([
      this.db.emailLog.count({ where: windowWhere }),
      this.db.emailLog.count({
        where: { ...windowWhere, status: { in: ['delivered', 'sent'] } },
      }),
      this.db.emailLog.count({ where: { ...windowWhere, status: 'failed' } }),
      this.db.emailLog.count({
        where: { ...windowWhere, status: { in: ['bounced', 'complained'] } },
      }),
    ]);
    return { total, delivered, failed, bounced };
  }

  @Get('suppressions')
  async listSuppressions(
    @Query('page') page?: number,
    @Query('perPage') perPage?: number,
  ) {
    const pageNum = page || 1;
    const limit = Math.min(perPage || 25, 100);
    const offset = (pageNum - 1) * limit;

    const [total, items] = await Promise.all([
      this.db.emailBounceSuppression.count(),
      this.db.emailBounceSuppression.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          email: true,
          reason: true,
          sourceEventId: true,
          createdAt: true,
        },
      }),
    ]);

    return { total, page: pageNum, perPage: limit, items };
  }

  @Delete('suppressions/:email')
  async deleteSuppression(@Param('email') emailParam: string) {
    const email = decodeURIComponent(emailParam).trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('email is required');
    }
    await this.db.emailBounceSuppression.deleteMany({ where: { email } });
    return { status: 'removed' };
  }

  @Get('queue')
  async getQueue(
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('perPage') perPage?: number,
  ) {
    const pageNum = page || 1;
    const limit = perPage || 25;
    const offset = (pageNum - 1) * limit;

    const where: any = {};
    if (status && status !== 'all') {
      where.status = status.toUpperCase();
    }

    const [total, items] = await Promise.all([
      this.db.emailQueue.count({ where }),
      this.db.emailQueue.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          toEmail: true,
          subject: true,
          emailType: true,
          priority: true,
          status: true,
          scheduledFor: true,
          sentAt: true,
          attempts: true,
          lastError: true,
          createdAt: true,
        },
      }),
    ]);

    return { total, page: pageNum, perPage: limit, items };
  }

  @Get('logs')
  async getLogs(
    @Query('status') status?: string,
    @Query('eventType') eventType?: string,
    @Query('recipientEmail') recipientEmail?: string,
    @Query('from') fromIso?: string,
    @Query('to') toIso?: string,
    @Query('page') page?: number,
    @Query('perPage') perPage?: number,
  ) {
    const pageNum = page || 1;
    const limit = Math.min(perPage || 25, 100);
    const offset = (pageNum - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (eventType) where.eventType = eventType;
    if (recipientEmail) {
      where.recipientEmail = { contains: recipientEmail };
    }
    if (fromIso || toIso) {
      const createdAt: { gte?: Date; lte?: Date } = {};
      if (fromIso) createdAt.gte = new Date(fromIso);
      if (toIso) createdAt.lte = new Date(toIso);
      where.createdAt = createdAt;
    }

    const [total, items] = await Promise.all([
      this.db.emailLog.count({ where }),
      this.db.emailLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          recipientEmail: true,
          eventType: true,
          subject: true,
          status: true,
          provider: true,
          providerMessageId: true,
          templateSlug: true,
          sentAt: true,
          createdAt: true,
          errorMessage: true,
          queueId: true,
        },
      }),
    ]);

    return { total, page: pageNum, perPage: limit, items };
  }

  @Post('queue/:id/retry')
  async retryEmail(@Param('id') emailId: string) {
    await this.db.emailQueue.updateMany({
      where: { id: emailId, status: 'FAILED' },
      data: {
        status: 'PENDING',
        attempts: 0,
        lastError: null,
        nextRetryAt: null,
        updatedAt: new Date(),
      },
    });
    return { status: 'requeued' };
  }

  @Post('queue/:id/cancel')
  async cancelEmail(@Param('id') emailId: string) {
    await this.db.emailQueue.updateMany({
      where: {
        id: emailId,
        status: { in: ['PENDING', 'SCHEDULED'] },
      },
      data: {
        status: 'CANCELLED',
        updatedAt: new Date(),
      },
    });
    return { status: 'cancelled' };
  }
}
