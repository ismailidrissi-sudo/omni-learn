import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
@Injectable()
export class GeoRedisCacheService implements OnModuleDestroy {
  private readonly log = new Logger(GeoRedisCacheService.name);
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
        this.client.on('error', (e) => this.log.warn(`Redis cache: ${e.message}`));
      } catch (e) {
        this.log.warn(`Redis cache disabled: ${e}`);
        this.client = null;
      }
    }
    return this.client;
  }

  onModuleDestroy() {
    void this.client?.quit();
    this.client = null;
  }

  async getJson<T>(key: string): Promise<T | null> {
    const r = this.getRedis();
    if (!r) return null;
    try {
      const raw = await r.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSec: number): Promise<void> {
    const r = this.getRedis();
    if (!r) return;
    try {
      await r.set(key, JSON.stringify(value), 'EX', ttlSec);
    } catch {
      /* ignore */
    }
  }

  async rpushCap(key: string, item: string, maxLen: number): Promise<void> {
    const r = this.getRedis();
    if (!r) return;
    try {
      await r.lpush(key, item);
      await r.ltrim(key, 0, maxLen - 1);
    } catch {
      /* ignore */
    }
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const r = this.getRedis();
    if (!r) return [];
    try {
      return r.lrange(key, start, stop);
    } catch {
      return [];
    }
  }

  async setJsonNoExpiry(key: string, value: unknown): Promise<void> {
    const r = this.getRedis();
    if (!r) return;
    try {
      await r.set(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }
}
