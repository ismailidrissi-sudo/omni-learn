import { Injectable, BadRequestException } from '@nestjs/common';
import { countries as countriesData } from 'countries-list';
import { PrismaService } from '../prisma/prisma.service';
import { GeoRedisCacheService } from '../analytics/geo-redis-cache.service';
import { RequestUserPayload } from '../auth/types/request-user.types';
import { RbacRole } from '../constants/rbac.constant';
import {
  continentFromCountryCode,
  englishCountryNameFromCode,
  normalizeCountryCodeForAggregation,
} from '../analytics/geo-constants';
import { GeoMetric } from './geo-graphql.enums';
import type {
  CountryComparisonEntryGql,
  CountryComparisonGql,
  CountryDetailGql,
  CountrySearchResultGql,
  CountryStatsGql,
  CountryTrendLineGql,
  GeoOverviewGql,
  LiveActivityEntryGql,
} from './geo-graphql.types';

function periodCacheKey(start: Date, end: Date) {
  return `${start.toISOString().slice(0, 10)}_${end.toISOString().slice(0, 10)}`;
}

function privacyName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return 'Learner';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].slice(0, 1)}.`;
}

function normCityLabel(c: string | null | undefined): string {
  const t = (c ?? '').trim();
  return t.length > 0 ? t : 'Unknown';
}

function roundCoord(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/** Mirrors GeoRollupService.cityBucket for session / IP rows. */
function cityBucketForSession(city: string | null | undefined, region: string | null | undefined): string {
  const c = (city ?? '').trim();
  if (!c) return '';
  const r = (region ?? '').trim();
  const label = r ? `${c}, ${r}` : c;
  return label.length > 100 ? label.slice(0, 100) : label;
}

@Injectable()
export class GeoAnalyticsGqlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: GeoRedisCacheService,
  ) {}

  /** Returns null when super admin queries all tenants (no filter). */
  resolveTenantId(user: RequestUserPayload, requested: string | null | undefined): string | null {
    const isSuper = user.roles.includes(RbacRole.SUPER_ADMIN);
    if (isSuper) {
      return requested || null;
    }
    if (!user.tenantId) throw new BadRequestException('No tenant context');
    if (requested && requested !== user.tenantId) {
      throw new BadRequestException('Cannot query another tenant');
    }
    return user.tenantId;
  }

  private metricValue(row: CountryStatsGql, metric: GeoMetric): number {
    switch (metric) {
      case GeoMetric.NEW_REGISTRATIONS:
        return row.newRegistrations;
      case GeoMetric.COURSE_COMPLETIONS:
        return row.courseCompletions;
      case GeoMetric.CERTS_ISSUED:
        return row.certsIssued;
      case GeoMetric.TOTAL_TIME_SPENT:
        return row.totalTimeSpentMin;
      default:
        return row.activeUsers;
    }
  }

  async getGeoOverview(
    user: RequestUserPayload,
    tenantIdArg: string | null | undefined,
    start: Date,
    end: Date,
    metric: GeoMetric,
  ): Promise<GeoOverviewGql> {
    const tenantId = this.resolveTenantId(user, tenantIdArg);
    const p = periodCacheKey(start, end);
    const cacheKey = `analytics:geo:overview:v4:${tenantId}:${p}`;
    const cached = await this.cache.getJson<GeoOverviewGql>(cacheKey);
    if (cached) return cached;

    const rollups = await this.prisma.geoAnalyticsRollup.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        period: 'daily',
        periodStart: { gte: start, lte: end },
        city: '',
      },
    });

    const merged = new Map<
      string,
      {
        country: string;
        countryCode: string;
        activeUsers: number;
        newRegistrations: number;
        courseCompletions: number;
        pathCompletions: number;
        certsIssued: number;
        totalTimeSpentMin: number;
        quizW: number;
        quizN: number;
        webSessions: number;
        iosSessions: number;
        androidSessions: number;
      }
    >();

    for (const r of rollups) {
      const k = normalizeCountryCodeForAggregation(r.countryCode);
      if (!merged.has(k)) {
        merged.set(k, {
          country: r.country,
          countryCode: k,
          activeUsers: 0,
          newRegistrations: 0,
          courseCompletions: 0,
          pathCompletions: 0,
          certsIssued: 0,
          totalTimeSpentMin: 0,
          quizW: 0,
          quizN: 0,
          webSessions: 0,
          iosSessions: 0,
          androidSessions: 0,
        });
      }
      const m = merged.get(k)!;
      m.country = r.country;
      m.activeUsers += r.activeUsers;
      m.newRegistrations += r.newRegistrations;
      m.courseCompletions += r.courseCompletions;
      m.pathCompletions += r.pathCompletions;
      m.certsIssued += r.certsIssued;
      m.totalTimeSpentMin += r.totalTimeSpentMin;
      m.webSessions += r.webSessions;
      m.iosSessions += r.iosSessions;
      m.androidSessions += r.androidSessions;
      if (r.avgQuizScore != null && r.quizAttempts > 0) {
        m.quizW += r.avgQuizScore * r.quizAttempts;
        m.quizN += r.quizAttempts;
      }
    }

    const logWhereBase = {
      createdAt: { gte: start, lte: end },
      countryCode: { not: null },
      city: { not: null },
      ...(tenantId ? { user: { tenantId } } : {}),
    };
    const topCitiesRows = await this.prisma.contentAccessLog.groupBy({
      by: ['countryCode', 'city', 'region'],
      where: logWhereBase,
      _count: { id: true },
    });

    const cityBuckets = new Map<string, { label: string; n: number }[]>();
    for (const row of topCitiesRows) {
      const code = normalizeCountryCodeForAggregation(row.countryCode);
      if (code === 'ZZ' || !row.city) continue;
      if (!cityBuckets.has(code)) cityBuckets.set(code, []);
      const r = row.region?.trim();
      const label = r ? `${row.city}, ${r}` : row.city;
      cityBuckets.get(code)!.push({ label, n: row._count.id });
    }
    const topCityByCode = new Map<string, string>();
    const topCitiesPreviewByCode = new Map<string, string>();
    for (const [code, bucket] of cityBuckets) {
      bucket.sort((a, b) => b.n - a.n);
      const names = bucket.slice(0, 3).map((x) => x.label);
      if (names.length) {
        topCityByCode.set(code, names[0]);
        topCitiesPreviewByCode.set(code, names.join(', '));
      }
    }

    let countries: CountryStatsGql[] = [...merged.values()].map((m) => {
      const cc = normalizeCountryCodeForAggregation(m.countryCode);
      return {
        country: m.country,
        countryCode: cc,
        topCity: topCityByCode.get(cc) ?? null,
        topCitiesPreview: topCitiesPreviewByCode.get(cc) ?? null,
        activeUsers: m.activeUsers,
        newRegistrations: m.newRegistrations,
        courseCompletions: m.courseCompletions,
        pathCompletions: m.pathCompletions,
        certsIssued: m.certsIssued,
        totalTimeSpentMin: m.totalTimeSpentMin,
        avgQuizScore: m.quizN > 0 ? m.quizW / m.quizN : null,
        webSessions: m.webSessions,
        iosSessions: m.iosSessions,
        androidSessions: m.androidSessions,
      };
    });

    const hasActiveUsers = countries.some((c) => c.activeUsers > 0);
    if (countries.length === 0 || !hasActiveUsers) {
      const sessionCountries = await this.fallbackOverviewFromSessions(
        tenantId,
        start,
        end,
        topCityByCode,
        topCitiesPreviewByCode,
      );
      if (sessionCountries.length > 0) {
        const existing = new Map(countries.map((c) => [c.countryCode, c]));
        for (const sc of sessionCountries) {
          const ex = existing.get(sc.countryCode);
          if (ex) {
            ex.activeUsers = Math.max(ex.activeUsers, sc.activeUsers);
          } else {
            countries.push(sc);
          }
        }
      }
    }

    countries.sort((a, b) => this.metricValue(b, metric) - this.metricValue(a, metric));

    const continentMap = new Map<string, { countries: Set<string>; activeUsers: number }>();
    let totalAct = 0;
    for (const c of countries) {
      totalAct += c.activeUsers;
      const cont = continentFromCountryCode(c.countryCode) ?? 'Unknown';
      if (!continentMap.has(cont)) {
        continentMap.set(cont, { countries: new Set(), activeUsers: 0 });
      }
      const cm = continentMap.get(cont)!;
      cm.countries.add(c.countryCode);
      cm.activeUsers += c.activeUsers;
    }

    const continents = [...continentMap.entries()].map(([continent, v]) => ({
      continent,
      countries: v.countries.size,
      activeUsers: v.activeUsers,
      percentageOfTotal: totalAct > 0 ? Math.round((v.activeUsers / totalAct) * 1000) / 10 : 0,
    }));

    const cityCount = await this.prisma.contentAccessLog.groupBy({
      by: ['city'],
      where: {
        createdAt: { gte: start, lte: end },
        city: { not: null },
        ...(tenantId ? { user: { tenantId } } : {}),
      },
      _count: { id: true },
    });

    countries = countries.map((c) => ({
      ...c,
      country: englishCountryNameFromCode(c.countryCode) ?? c.country,
    }));

    const out: GeoOverviewGql = {
      countries,
      continents,
      totalCountries: countries.length,
      totalCities: cityCount.filter((c) => c.city).length,
    };

    await this.cache.setJson(cacheKey, out, 300);
    return out;
  }

  private async fallbackOverviewFromSessions(
    tenantId: string | null,
    start: Date,
    end: Date,
    topCityByCode: Map<string, string>,
    topCitiesPreviewByCode: Map<string, string>,
  ): Promise<CountryStatsGql[]> {
    const groups = await this.prisma.userSession.groupBy({
      by: ['country', 'countryCode'],
      where: {
        ...(tenantId ? { tenantId } : {}),
        startedAt: { gte: start, lte: end },
        country: { not: null },
      },
      _count: { id: true },
    });
    const sessionMerged = new Map<
      string,
      { activeUsers: number; countryLabel: string }
    >();
    for (const g of groups) {
      const cc = normalizeCountryCodeForAggregation(g.countryCode);
      if (!sessionMerged.has(cc)) {
        sessionMerged.set(cc, { activeUsers: 0, countryLabel: g.country || '' });
      }
      const row = sessionMerged.get(cc)!;
      row.activeUsers += g._count.id;
    }
    return [...sessionMerged.entries()].map(([cc, v]) => ({
      country: v.countryLabel,
      countryCode: cc,
      topCity: topCityByCode.get(cc) ?? null,
      topCitiesPreview: topCitiesPreviewByCode.get(cc) ?? null,
      activeUsers: v.activeUsers,
      newRegistrations: 0,
      courseCompletions: 0,
      pathCompletions: 0,
      certsIssued: 0,
      totalTimeSpentMin: 0,
      avgQuizScore: null,
      webSessions: 0,
      iosSessions: 0,
      androidSessions: 0,
    }));
  }

  async getCountryAnalytics(
    user: RequestUserPayload,
    countryCode: string,
    start: Date,
    end: Date,
    tenantIdArg: string | null | undefined,
  ): Promise<CountryDetailGql> {
    const tenantId = this.resolveTenantId(user, tenantIdArg);
    const code = countryCode.toUpperCase();
    const cacheKey = `analytics:geo:country:v5:${tenantId}:${code}:${periodCacheKey(start, end)}`;
    const cached = await this.cache.getJson<CountryDetailGql>(cacheKey);
    if (cached) return cached;

    const users = await this.prisma.user.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        countryCode: code,
      },
      select: { id: true, city: true, name: true, createdAt: true },
    });
    const allUserIds = users.map((u) => u.id);

    const activeLogRows = await this.prisma.contentAccessLog.groupBy({
      by: ['userId'],
      where: {
        createdAt: { gte: start, lte: end },
        countryCode: code,
        user: tenantId ? { tenantId } : undefined,
      },
    });

    const courseCompletions = await this.prisma.courseEnrollment.count({
      where: {
        userId: { in: allUserIds },
        status: 'COMPLETED',
        completedAt: { gte: start, lte: end },
      },
    });

    const pathCompletionCount = await this.prisma.pathEnrollment.count({
      where: {
        userId: { in: allUserIds },
        status: 'COMPLETED',
        completedAt: { gte: start, lte: end },
      },
    });
    const totalCompletions = courseCompletions + pathCompletionCount;

    const certN = await this.prisma.issuedCertificate.count({
      where: {
        issuedAt: { gte: start, lte: end },
        OR: [
          { enrollment: { userId: { in: allUserIds } } },
          { courseEnrollment: { userId: { in: allUserIds } } },
        ],
      },
    });

    const logWhereCountry = {
      createdAt: { gte: start, lte: end },
      countryCode: code,
      ...(tenantId ? { user: { tenantId } } : {}),
    };

    /** Per-city traffic from resolved IP geo (ContentAccessLog), aligned with IPinfo-style city + region. */
    const triples = await this.prisma.contentAccessLog.groupBy({
      by: ['city', 'region', 'userId'],
      where: logWhereCountry,
      _count: { id: true },
    });

    const sessionsInCountry = await this.prisma.userSession.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        countryCode: code,
        startedAt: { gte: start, lte: end },
      },
      select: {
        userId: true,
        city: true,
        region: true,
        latitude: true,
        longitude: true,
        deviceType: true,
      },
    });

    const activeUserIds = new Set<string>([
      ...activeLogRows.map((r) => r.userId),
      ...sessionsInCountry.map((s) => s.userId),
    ]);

    const sessionUserIdList = [...new Set(sessionsInCountry.map((s) => s.userId))];
    const profileIdSet = new Set(users.map((u) => u.id));
    const onlySessionUserIds = sessionUserIdList.filter((id) => !profileIdSet.has(id));
    const onlySessionUsers =
      onlySessionUserIds.length === 0
        ? []
        : await this.prisma.user.findMany({
            where: { id: { in: onlySessionUserIds } },
            select: { id: true, createdAt: true },
          });
    const newSignups =
      users.filter((u) => u.createdAt >= start && u.createdAt <= end).length +
      onlySessionUsers.filter((u) => u.createdAt >= start && u.createdAt <= end).length;

    const registeredUsersKpi = users.length + onlySessionUserIds.length;

    type CityAgg = {
      city: string;
      region: string | null;
      registeredUserIds: Set<string>;
      activeUserIds: Set<string>;
    };
    const cityAgg = new Map<string, CityAgg>();

    for (const u of users) {
      const key = normCityLabel(u.city);
      if (!cityAgg.has(key)) {
        cityAgg.set(key, {
          city: key,
          region: null,
          registeredUserIds: new Set(),
          activeUserIds: new Set(),
        });
      }
      cityAgg.get(key)!.registeredUserIds.add(u.id);
    }

    for (const t of triples) {
      const cityLabel = normCityLabel(t.city);
      const regionLabel = t.region?.trim() || null;
      if (!cityAgg.has(cityLabel)) {
        cityAgg.set(cityLabel, {
          city: cityLabel,
          region: regionLabel,
          registeredUserIds: new Set(),
          activeUserIds: new Set(),
        });
      }
      const entry = cityAgg.get(cityLabel)!;
      entry.activeUserIds.add(t.userId);
      if (regionLabel && !entry.region) entry.region = regionLabel;
    }

    for (const s of sessionsInCountry) {
      const bucket = cityBucketForSession(s.city, s.region);
      const cityLabel = bucket || 'Unknown';
      const regionLabel = s.region?.trim() || null;
      if (!cityAgg.has(cityLabel)) {
        cityAgg.set(cityLabel, {
          city: cityLabel,
          region: regionLabel,
          registeredUserIds: new Set(),
          activeUserIds: new Set(),
        });
      }
      const entry = cityAgg.get(cityLabel)!;
      entry.activeUserIds.add(s.userId);
      if (regionLabel && !entry.region) entry.region = regionLabel;
    }

    const sortedCityEntries = [...cityAgg.values()].sort((a, b) => {
      const rc = b.registeredUserIds.size - a.registeredUserIds.size;
      if (rc !== 0) return rc;
      return b.activeUserIds.size - a.activeUserIds.size;
    });

    const cities: {
      city: string;
      region: string | null;
      totalUsers: number;
      activeUsers: number;
      completions: number;
    }[] = await Promise.all(
      sortedCityEntries.map(async (agg) => {
        const uidSet = new Set<string>([...agg.registeredUserIds, ...agg.activeUserIds]);
        const uids = [...uidSet];
        const [courseC, pathC] = await Promise.all([
          uids.length
            ? this.prisma.courseEnrollment.count({
                where: {
                  userId: { in: uids },
                  status: 'COMPLETED',
                  completedAt: { gte: start, lte: end },
                },
              })
            : Promise.resolve(0),
          uids.length
            ? this.prisma.pathEnrollment.count({
                where: {
                  userId: { in: uids },
                  status: 'COMPLETED',
                  completedAt: { gte: start, lte: end },
                },
              })
            : Promise.resolve(0),
        ]);
        return {
          city: agg.city,
          region: agg.region,
          totalUsers: agg.registeredUserIds.size,
          activeUsers: agg.activeUserIds.size,
          completions: courseC + pathC,
        };
      }),
    );

    const regionSessions = await this.prisma.contentAccessLog.groupBy({
      by: ['region'],
      where: logWhereCountry,
      _count: { id: true },
    });
    const regionUserPairs = await this.prisma.contentAccessLog.groupBy({
      by: ['region', 'userId'],
      where: logWhereCountry,
    });
    const usersByRegion = new Map<string, Set<string>>();
    for (const row of regionUserPairs) {
      const reg = (row.region ?? '').trim() || 'Unknown';
      if (!usersByRegion.has(reg)) usersByRegion.set(reg, new Set());
      usersByRegion.get(reg)!.add(row.userId);
    }

    const sessionCountByRegion = new Map<string, number>();
    const sessionUsersByRegion = new Map<string, Set<string>>();
    for (const s of sessionsInCountry) {
      const reg = (s.region ?? '').trim() || 'Unknown';
      sessionCountByRegion.set(reg, (sessionCountByRegion.get(reg) ?? 0) + 1);
      if (!sessionUsersByRegion.has(reg)) sessionUsersByRegion.set(reg, new Set());
      sessionUsersByRegion.get(reg)!.add(s.userId);
    }

    const mergedSessionCounts = new Map<string, number>();
    for (const r of regionSessions) {
      const reg = (r.region ?? '').trim() || 'Unknown';
      mergedSessionCounts.set(reg, (mergedSessionCounts.get(reg) ?? 0) + r._count.id);
    }
    for (const [reg, n] of sessionCountByRegion) {
      mergedSessionCounts.set(reg, (mergedSessionCounts.get(reg) ?? 0) + n);
    }

    const mergedRegionUsers = new Map<string, Set<string>>();
    for (const [reg, set] of usersByRegion) {
      mergedRegionUsers.set(reg, new Set(set));
    }
    for (const [reg, set] of sessionUsersByRegion) {
      if (!mergedRegionUsers.has(reg)) mergedRegionUsers.set(reg, new Set());
      for (const uid of set) mergedRegionUsers.get(reg)!.add(uid);
    }

    const allRegionKeys = new Set<string>([...mergedSessionCounts.keys(), ...mergedRegionUsers.keys()]);
    const regions = [...allRegionKeys]
      .map((reg) => ({
        region: reg,
        users: mergedRegionUsers.get(reg)?.size ?? 0,
        sessions: mergedSessionCounts.get(reg) ?? 0,
      }))
      .sort((a, b) => b.sessions - a.sessions || b.users - a.users)
      .slice(0, 25);

    const locPairs = await this.prisma.contentAccessLog.groupBy({
      by: ['latitude', 'longitude', 'userId'],
      where: {
        ...logWhereCountry,
        latitude: { not: null },
        longitude: { not: null },
      },
    });
    const locBuckets = new Map<
      string,
      { latitude: number; longitude: number; users: Set<string> }
    >();
    for (const row of locPairs) {
      if (row.latitude == null || row.longitude == null) continue;
      const lat = roundCoord(row.latitude, 2);
      const lng = roundCoord(row.longitude, 2);
      const key = `${lat},${lng}`;
      if (!locBuckets.has(key)) {
        locBuckets.set(key, { latitude: lat, longitude: lng, users: new Set() });
      }
      locBuckets.get(key)!.users.add(row.userId);
    }
    for (const s of sessionsInCountry) {
      if (s.latitude == null || s.longitude == null) continue;
      const lat = roundCoord(s.latitude, 2);
      const lng = roundCoord(s.longitude, 2);
      const key = `${lat},${lng}`;
      if (!locBuckets.has(key)) {
        locBuckets.set(key, { latitude: lat, longitude: lng, users: new Set() });
      }
      locBuckets.get(key)!.users.add(s.userId);
    }
    const locations = [...locBuckets.values()]
      .map((b) => ({
        latitude: b.latitude,
        longitude: b.longitude,
        users: b.users.size,
      }))
      .sort((a, b) => b.users - a.users)
      .slice(0, 200);

    const logs = await this.prisma.contentAccessLog.groupBy({
      by: ['deviceType'],
      where: {
        createdAt: { gte: start, lte: end },
        countryCode: code,
        user: tenantId ? { tenantId } : undefined,
      },
      _count: { id: true },
    });
    const sessionDeviceRows = await this.prisma.userSession.groupBy({
      by: ['deviceType'],
      where: {
        ...(tenantId ? { tenantId } : {}),
        countryCode: code,
        startedAt: { gte: start, lte: end },
      },
      _count: { id: true },
    });
    let web = 0,
      ios = 0,
      android = 0;
    for (const l of logs) {
      const d = (l.deviceType || 'web').toLowerCase();
      const n = l._count.id;
      if (d === 'ios') ios += n;
      else if (d === 'android') android += n;
      else web += n;
    }
    for (const row of sessionDeviceRows) {
      const dt = (row.deviceType || 'DESKTOP').toString().toUpperCase();
      const n = row._count.id;
      if (dt === 'MOBILE') ios += n;
      else if (dt === 'TABLET') android += n;
      else web += n;
    }
    const t = web + ios + android || 1;

    const domainRows = await this.prisma.contentAccessLog.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        countryCode: code,
        user: tenantId ? { tenantId } : undefined,
      },
      select: {
        content: { select: { domainId: true, domain: { select: { name: true } } } },
        userId: true,
      },
      take: 5000,
    });
    const domainCounts = new Map<string, { name: string; users: Set<string> }>();
    for (const row of domainRows) {
      const did = row.content?.domainId || '_none';
      const name = row.content?.domain?.name || 'Uncategorized';
      if (!domainCounts.has(did)) domainCounts.set(did, { name, users: new Set() });
      domainCounts.get(did)!.users.add(row.userId);
    }
    const totalDomainUsers = [...domainCounts.values()].reduce((s, v) => s + v.users.size, 0) || 1;
    const domainPopularity = [...domainCounts.entries()].map(([domainId, v]) => ({
      domainId,
      domainName: v.name,
      percentage: Math.round((v.users.size / totalDomainUsers) * 1000) / 10,
      userCount: v.users.size,
    }));

    const leaderUserIds = [...activeUserIds];
    const leaderboardUsers =
      leaderUserIds.length === 0
        ? []
        : await this.prisma.user.findMany({
            where: {
              id: { in: leaderUserIds },
              ...(tenantId ? { tenantId } : {}),
            },
            select: { id: true, city: true, name: true },
          });

    const pointsRows =
      leaderUserIds.length === 0
        ? []
        : await this.prisma.userPoints.findMany({
            where: { userId: { in: leaderUserIds } },
          });
    const pointsMap = new Map(pointsRows.map((p) => [p.userId, p.points]));
    const pathCounts =
      leaderUserIds.length === 0
        ? []
        : await this.prisma.pathEnrollment.groupBy({
            by: ['userId'],
            where: { userId: { in: leaderUserIds }, status: 'COMPLETED' },
            _count: { id: true },
          });
    const pathMap = new Map(pathCounts.map((p) => [p.userId, p._count.id]));

    const topLearners = leaderboardUsers
      .map((u) => ({
        userId: u.id,
        displayName: privacyName(u.name),
        city: u.city,
        points: pointsMap.get(u.id) ?? 0,
        pathsDone: pathMap.get(u.id) ?? 0,
        certs: 0,
      }))
      .sort((a, b) => b.points - a.points || b.pathsDone - a.pathsDone || a.userId.localeCompare(b.userId))
      .slice(0, 10);

    const named = await this.prisma.user.findFirst({
      where: { ...(tenantId ? { tenantId } : {}), countryCode: code, country: { not: null } },
      select: { country: true },
    });
    const countryName = englishCountryNameFromCode(code) ?? named?.country ?? code;

    const detail: CountryDetailGql = {
      country: countryName,
      countryCode: code,
      cities,
      regions,
      locations,
      domainPopularity,
      dailyTrend: [],
      deviceBreakdown: {
        web,
        ios,
        android,
        webPct: Math.round((web / t) * 1000) / 10,
        iosPct: Math.round((ios / t) * 1000) / 10,
        androidPct: Math.round((android / t) * 1000) / 10,
      },
      topLearners,
      kpis: {
        registeredUsers: registeredUsersKpi,
        activeUsers: activeUserIds.size,
        activeUsersDelta: 0,
        newSignups,
        newSignupsDelta: 0,
        completions: totalCompletions,
        completionsDelta: 0,
        certsIssued: certN,
      },
    };

    await this.cache.setJson(cacheKey, detail, 300);
    return detail;
  }

  async compareCountries(
    user: RequestUserPayload,
    codes: string[],
    start: Date,
    end: Date,
    tenantIdArg: string | null | undefined,
  ): Promise<CountryComparisonGql> {
    if (codes.length < 2 || codes.length > 4) {
      throw new BadRequestException('Select 2–4 countries');
    }
    const tenantId = this.resolveTenantId(user, tenantIdArg);
    const hash = `${codes.sort().join(',')}:${periodCacheKey(start, end)}:${tenantId}`;
    const cacheKey = `analytics:geo:compare:${hash}`;
    const cached = await this.cache.getJson<CountryComparisonGql>(cacheKey);
    if (cached) return cached;

    const countries: CountryComparisonEntryGql[] = [];
    const trendOverlay: CountryTrendLineGql[] = [];

    for (const raw of codes) {
      const d = await this.getCountryAnalytics(user, raw, start, end, tenantIdArg);
      const topDomain = d.domainPopularity[0]?.domainName ?? '—';
      const topCity = d.cities[0]?.city ?? '—';
      countries.push({
        country: d.country,
        countryCode: d.countryCode,
        activeUsers: d.kpis.activeUsers,
        avgTimePerUser: 0,
        completionRate: 0,
        topDomain,
        topCity,
        certsIssued: d.kpis.certsIssued,
        avgQuizScore: 0,
      });
      trendOverlay.push({
        country: d.country,
        countryCode: d.countryCode,
        dailyData: [],
      });
    }

    const out = { countries, trendOverlay };
    await this.cache.setJson(cacheKey, out, 300);
    return out;
  }

  async liveActivity(
    user: RequestUserPayload,
    limit: number,
    countryCode: string | null | undefined,
    tenantIdArg: string | null | undefined,
  ): Promise<LiveActivityEntryGql[]> {
    const tenantId = this.resolveTenantId(user, tenantIdArg);
    const since = new Date(Date.now() - 30 * 60 * 1000);
    const rows = await this.prisma.contentAccessLog.findMany({
      where: {
        createdAt: { gte: since },
        user: tenantId ? { tenantId } : undefined,
        ...(countryCode ? { countryCode: countryCode.toUpperCase() } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { name: true } },
        content: { select: { title: true } },
      },
    });

    return rows.map((r) => ({
      userId: r.userId,
      userName: privacyName(r.user.name),
      city: r.city || '',
      country: r.country || '',
      action: 'viewed content',
      contentTitle: r.content.title,
      timestamp: r.createdAt,
    }));
  }

  async searchCountries(query: string): Promise<CountrySearchResultGql[]> {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return Object.entries(countriesData)
      .filter(([, v]) => v.name.toLowerCase().includes(q))
      .slice(0, 25)
      .map(([code, v]) => ({ country: v.name, countryCode: code }));
  }
}
