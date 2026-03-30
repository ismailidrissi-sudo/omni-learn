import type { ConnectionOptions } from 'bullmq';

/** BullMQ / ioredis-friendly connection options (maxRetriesPerRequest required for BullMQ). */
export function bullRedisConnection(): ConnectionOptions {
  const url = process.env.REDIS_URL;
  if (url) {
    return {
      url,
      maxRetriesPerRequest: null,
    } as ConnectionOptions;
  }
  return {
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
  };
}
