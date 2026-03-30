import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GeoResolverService } from './geo-resolver.service';

@Injectable()
export class GeoBackfillService {
  private readonly log = new Logger(GeoBackfillService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly geoResolver: GeoResolverService,
  ) {}

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
