import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { encryptApiKey, decryptApiKey, maskApiKey } from './encryption.util';
import { ResendEmailProvider } from './providers/resend-email.provider';
import { SmtpEmailProvider } from './providers/smtp-email.provider';
import { EmailProvider } from './providers/email-provider.interface';

export interface ProviderUsage {
  thisMinute: number;
  thisHour: number;
  today: number;
  limitPerMinute: number;
  limitPerHour: number;
  limitPerDay: number;
  minuteResetAt: Date | null;
  hourResetAt: Date | null;
  dayResetAt: Date | null;
}

@Injectable()
export class EmailProviderConfigService {
  private readonly logger = new Logger(EmailProviderConfigService.name);
  private cache: any | null = null;
  private cacheExpiresAt = 0;
  private readonly CACHE_TTL_MS = 30_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly resendProvider: ResendEmailProvider,
    private readonly smtpProvider: SmtpEmailProvider,
  ) {}

  async getActiveConfig(): Promise<any | null> {
    const now = Date.now();
    if (this.cache && now < this.cacheExpiresAt) return this.cache;

    const config = await (this.prisma as any).emailProviderConfig.findFirst({
      where: { isActive: true },
    });

    if (config) {
      this.cache = config;
      this.cacheExpiresAt = now + this.CACHE_TTL_MS;
    }
    return config;
  }

  invalidateCache(): void {
    this.cache = null;
    this.cacheExpiresAt = 0;
  }

  resolveProvider(config: any): EmailProvider {
    return config.providerType === 'smtp' ? this.smtpProvider : this.resendProvider;
  }

  resolveProviderFromEnv(): EmailProvider {
    return process.env.EMAIL_TRANSPORT === 'smtp' ? this.smtpProvider : this.resendProvider;
  }

  async getById(id: string) {
    const config = await (this.prisma as any).emailProviderConfig.findUnique({ where: { id } });
    if (!config) throw new NotFoundException('Provider config not found');
    return config;
  }

  async listAll() {
    return (this.prisma as any).emailProviderConfig.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createConfig(dto: {
    providerType: string;
    displayName: string;
    isActive?: boolean;
    smtpHost?: string;
    smtpPort?: number;
    smtpUsername?: string;
    smtpPassword?: string;
    smtpUseTls?: boolean;
    smtpUseSsl?: boolean;
    smtpFromEmail?: string;
    smtpFromName?: string;
    resendApiKey?: string;
    resendFromDomain?: string;
    sendLimitPerMinute?: number;
    sendLimitPerHour?: number;
    sendLimitPerDay?: number;
    notes?: string;
  }) {
    if (dto.isActive) {
      await (this.prisma as any).emailProviderConfig.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
    }

    const data: any = {
      providerType: dto.providerType,
      displayName: dto.displayName,
      isActive: dto.isActive ?? false,
      smtpHost: dto.smtpHost,
      smtpPort: dto.smtpPort,
      smtpUsername: dto.smtpUsername,
      smtpUseTls: dto.smtpUseTls,
      smtpUseSsl: dto.smtpUseSsl,
      smtpFromEmail: dto.smtpFromEmail,
      smtpFromName: dto.smtpFromName,
      resendFromDomain: dto.resendFromDomain,
      sendLimitPerMinute: dto.sendLimitPerMinute ?? 10,
      sendLimitPerHour: dto.sendLimitPerHour ?? 100,
      sendLimitPerDay: dto.sendLimitPerDay ?? 500,
      notes: dto.notes,
    };

    if (dto.smtpPassword) {
      data.smtpPasswordEncrypted = encryptApiKey(dto.smtpPassword);
    }
    if (dto.resendApiKey) {
      data.resendApiKeyEncrypted = encryptApiKey(dto.resendApiKey);
    }

    const config = await (this.prisma as any).emailProviderConfig.create({ data });
    this.invalidateCache();
    return config;
  }

  async updateConfig(
    id: string,
    dto: Partial<{
      displayName: string;
      isActive: boolean;
      smtpHost: string;
      smtpPort: number;
      smtpUsername: string;
      smtpPassword: string;
      smtpUseTls: boolean;
      smtpUseSsl: boolean;
      smtpFromEmail: string;
      smtpFromName: string;
      resendApiKey: string;
      resendFromDomain: string;
      sendLimitPerMinute: number;
      sendLimitPerHour: number;
      sendLimitPerDay: number;
      notes: string;
    }>,
  ) {
    if (dto.isActive) {
      await (this.prisma as any).emailProviderConfig.updateMany({
        where: { isActive: true, id: { not: id } },
        data: { isActive: false },
      });
    }

    const data: any = { ...dto };
    delete data.smtpPassword;
    delete data.resendApiKey;

    if (dto.smtpPassword) {
      data.smtpPasswordEncrypted = encryptApiKey(dto.smtpPassword);
    }
    if (dto.resendApiKey) {
      data.resendApiKeyEncrypted = encryptApiKey(dto.resendApiKey);
    }

    const config = await (this.prisma as any).emailProviderConfig.update({
      where: { id },
      data,
    });
    this.invalidateCache();
    return config;
  }

  maskedView(config: any) {
    const result = { ...config };
    if (result.smtpPasswordEncrypted) {
      result.smtpPasswordMasked = '••••••••';
      delete result.smtpPasswordEncrypted;
    }
    if (result.resendApiKeyEncrypted) {
      try {
        const raw = decryptApiKey(result.resendApiKeyEncrypted);
        result.resendApiKeyMasked = maskApiKey(raw);
      } catch {
        result.resendApiKeyMasked = '••••••••';
      }
      delete result.resendApiKeyEncrypted;
    }
    return result;
  }

  async getCurrentUsage(configId?: string): Promise<ProviderUsage> {
    const config = configId
      ? await this.getById(configId)
      : await this.getActiveConfig();

    if (!config) {
      return {
        thisMinute: 0,
        thisHour: 0,
        today: 0,
        limitPerMinute: 10,
        limitPerHour: 100,
        limitPerDay: 500,
        minuteResetAt: null,
        hourResetAt: null,
        dayResetAt: null,
      };
    }

    return {
      thisMinute: config.emailsSentThisMinute ?? 0,
      thisHour: config.emailsSentThisHour ?? 0,
      today: config.emailsSentToday ?? 0,
      limitPerMinute: config.sendLimitPerMinute,
      limitPerHour: config.sendLimitPerHour,
      limitPerDay: config.sendLimitPerDay,
      minuteResetAt: config.minuteResetAt,
      hourResetAt: config.hourResetAt,
      dayResetAt: config.dayResetAt,
    };
  }

  async incrementUsage(configId: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE email_provider_config
      SET "emailsSentThisMinute" = "emailsSentThisMinute" + 1,
          "emailsSentThisHour"   = "emailsSentThisHour" + 1,
          "emailsSentToday"      = "emailsSentToday" + 1,
          "updatedAt"            = NOW()
      WHERE id = ${configId}
    `;
    this.invalidateCache();
  }

  canSend(usage: ProviderUsage): boolean {
    return (
      usage.thisMinute < usage.limitPerMinute &&
      usage.thisHour < usage.limitPerHour &&
      usage.today < usage.limitPerDay
    );
  }

  availableThisTick(usage: ProviderUsage, maxBatch: number): number {
    return Math.min(
      usage.limitPerMinute - usage.thisMinute,
      usage.limitPerHour - usage.thisHour,
      usage.limitPerDay - usage.today,
      maxBatch,
    );
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async resetExpiredCounters(): Promise<void> {
    const now = new Date();

    await this.prisma.$executeRaw`
      UPDATE email_provider_config
      SET "emailsSentThisMinute" = 0,
          "minuteResetAt" = NOW() + INTERVAL '1 minute',
          "updatedAt" = NOW()
      WHERE "minuteResetAt" IS NOT NULL AND "minuteResetAt" <= ${now}
    `;

    await this.prisma.$executeRaw`
      UPDATE email_provider_config
      SET "emailsSentThisHour" = 0,
          "hourResetAt" = NOW() + INTERVAL '1 hour',
          "updatedAt" = NOW()
      WHERE "hourResetAt" IS NOT NULL AND "hourResetAt" <= ${now}
    `;

    await this.prisma.$executeRaw`
      UPDATE email_provider_config
      SET "emailsSentToday" = 0,
          "dayResetAt" = NOW() + INTERVAL '1 day',
          "updatedAt" = NOW()
      WHERE "dayResetAt" IS NOT NULL AND "dayResetAt" <= ${now}
    `;
  }

  async initResetTimestamps(configId: string): Promise<void> {
    const now = new Date();
    await (this.prisma as any).emailProviderConfig.update({
      where: { id: configId },
      data: {
        minuteResetAt: new Date(now.getTime() + 60_000),
        hourResetAt: new Date(now.getTime() + 3_600_000),
        dayResetAt: new Date(now.getTime() + 86_400_000),
      },
    });
    this.invalidateCache();
  }

  async testConnection(configId: string): Promise<{ success: boolean; error?: string }> {
    const config = await this.getById(configId);
    const provider = this.resolveProvider(config);

    try {
      await provider.send({
        toEmail: config.smtpFromEmail || config.resendFromDomain
          ? `test@${config.resendFromDomain || 'test.com'}`
          : 'test@test.com',
        subject: 'OmniLearn Email Connection Test',
        htmlBody: '<p>This is a test email from OmniLearn.</p>',
      });

      await (this.prisma as any).emailProviderConfig.update({
        where: { id: configId },
        data: {
          lastTestAt: new Date(),
          lastTestStatus: 'success',
          lastTestError: null,
        },
      });

      return { success: true };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      await (this.prisma as any).emailProviderConfig.update({
        where: { id: configId },
        data: {
          lastTestAt: new Date(),
          lastTestStatus: 'failed',
          lastTestError: error,
        },
      });
      return { success: false, error };
    }
  }
}
