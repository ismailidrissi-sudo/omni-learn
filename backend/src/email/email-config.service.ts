import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface EmailConfig {
  id: string;
  provider: string;
  apiKey: string;
  apiKeyLastFour: string | null;
  defaultFromName: string;
  defaultFromEmail: string;
  defaultReplyTo: string | null;
  dailySendLimit: number;
  rateLimitPerSecond: number;
  overflowStrategy: string;
  overflowSendHour: number;
  isActive: boolean;
  lastVerifiedAt: Date | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class EmailConfigService {
  private readonly logger = new Logger(EmailConfigService.name);
  private cache: EmailConfig | null = null;
  private cacheExpiresAt: number = 0;
  private readonly CACHE_TTL_MS = 60_000;

  private readonly db: any;
  constructor(private readonly prisma: PrismaService) {
    this.db = prisma as any;
  }

  async getConfig(): Promise<EmailConfig> {
    const now = Date.now();
    if (this.cache && now < this.cacheExpiresAt) {
      return this.cache;
    }

    const config = await this.db.emailConfig.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!config) {
      throw new Error(
        'No email configuration found. Please configure email settings in the admin panel.',
      );
    }

    this.cache = config;
    this.cacheExpiresAt = now + this.CACHE_TTL_MS;
    return config;
  }

  invalidateCache(): void {
    this.cache = null;
    this.cacheExpiresAt = 0;
    this.logger.log('Email config cache invalidated');
  }

  async hasConfig(): Promise<boolean> {
    const count = await this.db.emailConfig.count();
    return count > 0;
  }
}
