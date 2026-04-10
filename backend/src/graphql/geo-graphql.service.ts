import { Injectable, BadRequestException } from '@nestjs/common';
import { countries as countriesData } from 'countries-list';
import { PrismaService } from '../prisma/prisma.service';
import { GeoRedisCacheService } from '../analytics/geo-redis-cache.service';
import { RequestUserPayload } from '../auth/types/request-user.types';
import { RbacRole } from '../constants/rbac.constant';
import { continentFromCountryCode, englishCountryNameFromCode } from '../analytics/geo-constants';
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
    const cacheKey = `analytics:geo:overview:v2:${tenantId}:${p}`;
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
      const k = (r.countryCode || 'ZZ').toUpperCase();
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
      by: ['countryCode', 'city'],
      where: logWhereBase,
      _count: { id: true },
    });

    const cityBuckets = new Map<string, { city: string; n: number }[]>();
    for (const row of topCitiesRows) {
      const code = (row.countryCode || '').toUpperCase();
      if (!code || !row.city) continue;
      if (!cityBuckets.has(code)) cityBuckets.set(code, []);
      cityBuckets.get(code)!.push({ city: row.city, n: row._count.id });
    }
    const topCityByCode = new Map<string, string>();
    const topCitiesPreviewByCode = new Map<string, string>();
    for (const [code, bucket] of cityBuckets) {
      bucket.sort((a, b) => b.n - a.n);
      const names = bucket.slice(0, 3).map((x) => x.city);
      if (names.length) {
        topCityByCode.set(code, names[0]);
        topCitiesPreviewByCode.set(code, names.join(', '));
      }
    }

    let countries: CountryStatsGql[] = [...merged.values()].map((m) => {
      const cc = m.countryCode.toUpperCase();
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
    return groups.map((g) => {
      const cc = (g.countryCode || '').toUpperCase() || 'ZZ';
      return {
        country: g.country || '',
        countryCode: cc,
        topCity: topCityByCode.get(cc) ?? null,
        topCitiesPreview: topCitiesPreviewByCode.get(cc) ?? null,
        activeUsers: g._count.id,
        newRegistrations: 0,
        courseCompletions: 0,
        pathCompletions: 0,
        certsIssued: 0,
        totalTimeSpentMin: 0,
        avgQuizScore: null,
        webSessions: 0,
        iosSessions: 0,
        androidSessions: 0,
      };
    });
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
    const cacheKey = `analytics:geo:country:${tenantId}:${code}:${periodCacheKey(start, end)}`;
    const cached = await this.cache.getJson<CountryDetailGql>(cacheKey);
    if (cached) return cached;

    const users = await this.prisma.user.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        countryCode: code,
      },
      select: { id: true, city: true, name: true },
    });

    const cityMap = new Map<string, { totalUsers: number; ids: Set<string> }>();
    for (const u of users) {
      const city = u.city || 'Unknown';
      if (!cityMap.has(city)) cityMap.set(city, { totalUsers: 0, ids: new Set() });
      const c = cityMap.get(city)!;
      c.totalUsers += 1;
      c.ids.add(u.id);
    }

    const cities = [...cityMap.entries()].map(([city, v]) => ({
      city,
      region: null as string | null,
      totalUsers: v.totalUsers,
      activeUsers: v.totalUsers,
      completions: 0,
    }));

    const logs = await this.prisma.contentAccessLog.groupBy({
      by: ['deviceType'],
      where: {
        createdAt: { gte: start, lte: end },
        countryCode: code,
        user: tenantId ? { tenantId } : undefined,
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

    const pointsRows = await this.prisma.userPoints.findMany({
      where: { userId: { in: users.map((u) => u.id) } },
    });
    const pointsMap = new Map(pointsRows.map((p) => [p.userId, p.points]));
    const pathCounts = await this.prisma.pathEnrollment.groupBy({
      by: ['userId'],
      where: { userId: { in: users.map((u) => u.id) }, status: 'COMPLETED' },
      _count: { id: true },
    });
    const pathMap = new Map(pathCounts.map((p) => [p.userId, p._count.id]));
    const certN = await this.prisma.issuedCertificate.count({
      where: {
        OR: [
          { enrollment: { userId: { in: users.map((u) => u.id) } } },
          { courseEnrollment: { userId: { in: users.map((u) => u.id) } } },
        ],
      },
    });

    const topLearners = users
      .map((u) => ({
        userId: u.id,
        displayName: privacyName(u.name),
        city: u.city,
        points: pointsMap.get(u.id) ?? 0,
        pathsDone: pathMap.get(u.id) ?? 0,
        certs: 0,
      }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 10);
    void certN;

    const named = await this.prisma.user.findFirst({
      where: { ...(tenantId ? { tenantId } : {}), countryCode: code, country: { not: null } },
      select: { country: true },
    });
    const countryName = englishCountryNameFromCode(code) ?? named?.country ?? code;

    const detail: CountryDetailGql = {
      country: countryName,
      countryCode: code,
      cities,
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
        activeUsers: users.length,
        activeUsersDelta: 0,
        newSignups: 0,
        newSignupsDelta: 0,
        completions: 0,
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
