import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GeoResolverService } from './geo-resolver.service';
import { GeoRollupService } from './geo-rollup.service';

@Injectable()
export class GeoBackfillService implements OnModuleInit {
  private readonly log = new Logger(GeoBackfillService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly geoResolver: GeoResolverService,
    private readonly geoRollup: GeoRollupService,
  ) {}

  async onModuleInit() {
    const missing = await this.prisma.userSession.count({
      where: {
        ipAddress: { not: null },
        OR: [{ country: null }, { countryCode: null }],
      },
    });
    if (missing === 0) return;

    this.log.log(`Found ${missing} sessions with missing geo — starting auto-backfill...`);

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

        this.log.log('Running daily geo rollup after backfill...');
        const rollup = await this.geoRollup.runRollup('daily', new Date());
        this.log.log(`Post-backfill rollup done: ${rollup.rows} rows`);
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
