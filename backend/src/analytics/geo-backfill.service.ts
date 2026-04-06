import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GeoResolverService } from './geo-resolver.service';
import { GeoRollupService } from './geo-rollup.service';
import { GeoRedisCacheService } from './geo-redis-cache.service';

@Injectable()
export class GeoBackfillService implements OnModuleInit {
  private readonly log = new Logger(GeoBackfillService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly geoResolver: GeoResolverService,
    private readonly geoRollup: GeoRollupService,
    private readonly cache: GeoRedisCacheService,
  ) {}

  async onModuleInit() {
    const missingSessions = await this.prisma.userSession.count({
      where: {
        ipAddress: { not: null },
        OR: [{ country: null }, { countryCode: null }],
      },
    });
    const missingLogs = await this.prisma.contentAccessLog.count({
      where: {
        ipAddress: { not: null },
        OR: [{ country: null }, { countryCode: null }],
      },
    });

    this.log.log(`Geo status: ${missingSessions} sessions + ${missingLogs} logs missing geo data`);

    if (missingSessions === 0 && missingLogs === 0) return;

    setTimeout(async () => {
      try {
        let total = { contentLogs: 0, sessions: 0 };
        let hasMore = true;
        while (hasMore) {
          const batch = await this.runBatch(200);
          total.contentLogs += batch.contentLogs;
          total.sessions += batch.sessions;
          hasMore = batch.contentLogs > 0 || batch.sessions > 0;
        }
        this.log.log(`Auto-backfill complete: ${total.contentLogs} logs, ${total.sessions} sessions`);

        this.log.log('Clearing stale geo rollups and Redis cache...');
        await this.prisma.geoAnalyticsRollup.deleteMany({});
        const cleared = await this.cache.clearGeoCache();
        this.log.log(`Cleared ${cleared} cached geo keys`);

        this.log.log('Regenerating daily rollups for the last 90 days...');
        const now = new Date();
        for (let daysBack = 0; daysBack < 90; daysBack++) {
          const anchor = new Date(now.getTime() - daysBack * 86400000);
          await this.geoRollup.runRollup('daily', anchor);
        }
        this.log.log('Post-backfill rollup regeneration complete');
      } catch (e) {
        this.log.warn(`Auto-backfill error: ${e}`);
      }
    }, 5000);
  }

  async runBatch(limit = 300): Promise<{ contentLogs: number; sessions: number }> {
    let contentLogs = 0;
    let sessions = 0;

    const logs = await this.prisma.contentAccessLog.findMany({
      where: {
        ipAddress: { not: null },
        OR: [{ country: null }, { countryCode: null }],
      },
      take: limit,
      select: { id: true, userId: true, ipAddress: true },
    });

    for (const row of logs) {
      const geo = await this.geoResolver.resolve(row.ipAddress || undefined, row.userId);
      if (!geo.country && !geo.countryCode) continue;
      await this.prisma.contentAccessLog.update({
        where: { id: row.id },
        data: {
          country: geo.country,
          countryCode: geo.countryCode,
          city: geo.city,
          region: geo.region,
          latitude: geo.latitude,
          longitude: geo.longitude,
          continent: geo.continent,
        },
      });
      contentLogs += 1;
    }

    const sess = await this.prisma.userSession.findMany({
      where: {
        ipAddress: { not: null },
        OR: [{ country: null }, { countryCode: null }],
      },
      take: limit,
      select: { id: true, userId: true, ipAddress: true },
    });

    for (const row of sess) {
      const geo = await this.geoResolver.resolve(row.ipAddress || undefined, row.userId);
      if (!geo.country && !geo.countryCode) continue;
      await this.prisma.userSession.update({
        where: { id: row.id },
        data: {
          country: geo.country,
          countryCode: geo.countryCode,
          city: geo.city,
          region: geo.region,
          latitude: geo.latitude,
          longitude: geo.longitude,
          continent: geo.continent,
        },
      });
      sessions += 1;
    }

    this.log.log(`Geo backfill batch: ${contentLogs} content logs, ${sessions} sessions`);
    return { contentLogs, sessions };
  }
}
