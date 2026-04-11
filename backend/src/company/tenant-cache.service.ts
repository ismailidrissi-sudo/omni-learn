import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

export interface TenantContentAccessEntry {
  assigned: boolean;
  bypassesPublicPaywall: boolean;
}

const DEFAULT_TTL_SEC = 300;

@Injectable()
export class TenantCacheService implements OnModuleDestroy {
  private readonly log = new Logger(TenantCacheService.name);
  private client: Redis | null = null;

  private getRedis(): Redis | null {
    if (process.env.REDIS_DISABLED === 'true') return null;
    if (!this.client) {
      try {
        const url = process.env.REDIS_URL;
        this.client = url
          ? new Redis(url, { maxRetriesPerRequest: null })
          : new Redis({
              host: process.env.REDIS_HOST ?? '127.0.0.1',
              port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
              password: process.env.REDIS_PASSWORD || undefined,
              maxRetriesPerRequest: null,
            });
        this.client.on('error', (e) => this.log.warn(`Redis: ${e.message}`));
      } catch (e) {
        this.log.warn(`Redis disabled: ${e}`);
        this.client = null;
      }
    }
    return this.client;
  }

  onModuleDestroy() {
    void this.client?.quit();
    this.client = null;
  }

  private contentKey(tenantId: string, contentId: string): string {
    return `access:tenant:${tenantId}:content:${contentId}`;
  }

  async getTenantContentAccess(
    tenantId: string,
    contentId: string,
  ): Promise<TenantContentAccessEntry | null> {
    const r = this.getRedis();
    if (!r) return null;
    try {
      const raw = await r.get(this.contentKey(tenantId, contentId));
      if (!raw) return null;
      return JSON.parse(raw) as TenantContentAccessEntry;
    } catch {
      return null;
    }
  }

  async setTenantContentAccess(
    tenantId: string,
    contentId: string,
    value: TenantContentAccessEntry,
    ttlSec = DEFAULT_TTL_SEC,
  ): Promise<void> {
    const r = this.getRedis();
    if (!r) return;
    try {
      await r.set(
        this.contentKey(tenantId, contentId),
        JSON.stringify(value),
        'EX',
        ttlSec,
      );
    } catch {
      /* graceful degradation */
    }
  }

  private async scanAndDelete(r: Redis, pattern: string): Promise<number> {
    let cursor = '0';
    let deleted = 0;
    do {
      const [nextCursor, keys] = await r.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await r.del(...keys);
        deleted += keys.length;
      }
    } while (cursor !== '0');
    return deleted;
  }

  async invalidateTenant(tenantId: string): Promise<number> {
    const r = this.getRedis();
    if (!r) return 0;
    try {
      return await this.scanAndDelete(r, `access:tenant:${tenantId}:*`);
    } catch {
      return 0;
    }
  }

  async invalidateContent(contentId: string): Promise<number> {
    const r = this.getRedis();
    if (!r) return 0;
    try {
      return await this.scanAndDelete(r, `access:tenant:*:content:${contentId}`);
    } catch {
      return 0;
    }
  }
}
