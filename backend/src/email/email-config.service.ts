import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { EmailConfig } from '@prisma/client';

@Injectable()
export class EmailConfigService {
  private readonly logger = new Logger(EmailConfigService.name);
  private cache: EmailConfig | null = null;
  private cacheExpiresAt: number = 0;
  private readonly CACHE_TTL_MS = 60_000;

  constructor(private readonly prisma: PrismaService) {}

  async getConfig(): Promise<EmailConfig> {
    const now = Date.now();
    if (this.cache && now < this.cacheExpiresAt) {
      return this.cache;
    }

    const config = await this.prisma.emailConfig.findFirst({
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
    const count = await this.prisma.emailConfig.count();
    return count > 0;
  }
}
