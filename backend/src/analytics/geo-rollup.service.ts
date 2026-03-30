import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { englishCountryNameFromCode } from './geo-constants';

export type RollupPeriod = 'hourly' | 'daily' | 'weekly' | 'monthly';

interface AggRow {
  country: string;
  countryCode: string;
  city: string;
  contentViews: number;
  activeUserIds: Set<string>;
  webSessions: number;
  iosSessions: number;
  androidSessions: number;
  newRegistrations: number;
  courseCompletions: number;
  pathCompletions: number;
  certsIssued: number;
  totalTimeSpentMin: number;
  quizAttempts: number;
  quizScoreSum: number;
  quizScoreCount: number;
}

@Injectable()
export class GeoRollupService {
  private readonly log = new Logger(GeoRollupService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** UTC window [start, end) for rollup bucket. */
  windowFor(period: RollupPeriod, anchor: Date): { start: Date; end: Date; periodStart: Date } {
    const a = new Date(anchor);
    a.setMilliseconds(0);

    if (period === 'hourly') {
      const start = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate(), a.getUTCHours(), 0, 0, 0));
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      return { start, end, periodStart: start };
    }

    if (period === 'daily') {
      const start = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate(), 0, 0, 0, 0));
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      return { start, end, periodStart: start };
    }

    if (period === 'weekly') {
      const d = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate(), 0, 0, 0, 0));
      const day = d.getUTCDay();
      const diff = (day + 6) % 7;
      const start = new Date(d.getTime() - diff * 24 * 60 * 60 * 1000);
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      return { start, end, periodStart: start };
    }

    const start = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + 1, 1, 0, 0, 0, 0));
    return { start, end, periodStart: start };
  }

  private keyCountry(tenantId: string, country: string, countryCode: string, city: string) {
    return `${tenantId}|${country}|${countryCode}|${city}`;
  }

  async runRollup(period: RollupPeriod, anchor: Date): Promise<{ rows: number }> {
    const { start, end, periodStart } = this.windowFor(period, anchor);
    this.log.log(`Geo rollup ${period} ${periodStart.toISOString()} [${start.toISOString()}, ${end.toISOString()})`);

    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    let totalRows = 0;

    for (const { id: tenantId } of tenants) {
      const map = new Map<string, AggRow>();

      const logs = await this.prisma.contentAccessLog.findMany({
        where: {
          createdAt: { gte: start, lt: end },
          user: { tenantId },
        },
        select: {
          userId: true,
          country: true,
          countryCode: true,
          city: true,
          deviceType: true,
        },
      });

      for (const row of logs) {
        const cc = (row.countryCode || '').toUpperCase() || 'ZZ';
        const cname = row.country || englishCountryNameFromCode(cc) || 'Unknown';
        const city = '';
        const k = this.keyCountry(tenantId, cname, cc, city);
        if (!map.has(k)) {
          map.set(k, {
            country: cname,
            countryCode: cc,
            city,
            contentViews: 0,
            activeUserIds: new Set(),
            webSessions: 0,
            iosSessions: 0,
            androidSessions: 0,
            newRegistrations: 0,
            courseCompletions: 0,
            pathCompletions: 0,
            certsIssued: 0,
            totalTimeSpentMin: 0,
            quizAttempts: 0,
            quizScoreSum: 0,
            quizScoreCount: 0,
          });
        }
        const agg = map.get(k)!;
        agg.contentViews += 1;
        agg.activeUserIds.add(row.userId);
        const dt = (row.deviceType || 'web').toLowerCase();
        if (dt === 'ios') agg.iosSessions += 1;
        else if (dt === 'android') agg.androidSessions += 1;
        else agg.webSessions += 1;
      }

      const newUsers = await this.prisma.user.findMany({
        where: {
          tenantId,
          createdAt: { gte: start, lt: end },
        },
        select: { id: true, country: true, countryCode: true },
      });
      for (const u of newUsers) {
        const cc = (u.countryCode || '').toUpperCase() || 'ZZ';
        const cname = u.country || englishCountryNameFromCode(cc) || 'Unknown';
        const city = '';
        const k = this.keyCountry(tenantId, cname, cc, city);
        if (!map.has(k)) {
          map.set(k, {
            country: cname,
            countryCode: cc,
            city,
            contentViews: 0,
            activeUserIds: new Set(),
            webSessions: 0,
            iosSessions: 0,
            androidSessions: 0,
            newRegistrations: 0,
            courseCompletions: 0,
            pathCompletions: 0,
            certsIssued: 0,
            totalTimeSpentMin: 0,
            quizAttempts: 0,
            quizScoreSum: 0,
            quizScoreCount: 0,
          });
        }
        map.get(k)!.newRegistrations += 1;
      }

      const courseDone = await this.prisma.courseEnrollment.findMany({
        where: {
          status: 'COMPLETED',
          completedAt: { gte: start, lt: end },
          course: { tenantId },
        },
        select: { userId: true },
      });
      const courseUserIds = [...new Set(courseDone.map((e) => e.userId))];
      const courseUsers = await this.prisma.user.findMany({
        where: { id: { in: courseUserIds } },
        select: { id: true, country: true, countryCode: true },
      });
      const courseUserMap = new Map(courseUsers.map((u) => [u.id, u]));
      for (const e of courseDone) {
        const u = courseUserMap.get(e.userId);
        if (!u) continue;
        const cc = (u.countryCode || '').toUpperCase() || 'ZZ';
        const cname = u.country || englishCountryNameFromCode(cc) || 'Unknown';
        const k = this.keyCountry(tenantId, cname, cc, '');
        if (!map.has(k)) {
          map.set(k, {
            country: cname,
            countryCode: cc,
            city: '',
            contentViews: 0,
            activeUserIds: new Set(),
            webSessions: 0,
            iosSessions: 0,
            androidSessions: 0,
            newRegistrations: 0,
            courseCompletions: 0,
            pathCompletions: 0,
            certsIssued: 0,
            totalTimeSpentMin: 0,
            quizAttempts: 0,
            quizScoreSum: 0,
            quizScoreCount: 0,
          });
        }
        map.get(k)!.courseCompletions += 1;
      }

      const pathDone = await this.prisma.pathEnrollment.findMany({
        where: {
          status: 'COMPLETED',
          completedAt: { gte: start, lt: end },
          path: { tenantId },
        },
        select: { userId: true },
      });
      const pathUserIds = [...new Set(pathDone.map((e) => e.userId))];
      const pathUsers = await this.prisma.user.findMany({
        where: { id: { in: pathUserIds } },
        select: { id: true, country: true, countryCode: true },
      });
      const pathUserMap = new Map(pathUsers.map((u) => [u.id, u]));
      for (const e of pathDone) {
        const u = pathUserMap.get(e.userId);
        if (!u) continue;
        const cc = (u.countryCode || '').toUpperCase() || 'ZZ';
        const cname = u.country || englishCountryNameFromCode(cc) || 'Unknown';
        const k = this.keyCountry(tenantId, cname, cc, '');
        if (!map.has(k)) {
          map.set(k, {
            country: cname,
            countryCode: cc,
            city: '',
            contentViews: 0,
            activeUserIds: new Set(),
            webSessions: 0,
            iosSessions: 0,
            androidSessions: 0,
            newRegistrations: 0,
            courseCompletions: 0,
            pathCompletions: 0,
            certsIssued: 0,
            totalTimeSpentMin: 0,
            quizAttempts: 0,
            quizScoreSum: 0,
            quizScoreCount: 0,
          });
        }
        map.get(k)!.pathCompletions += 1;
      }

      const certs = await this.prisma.issuedCertificate.findMany({
        where: {
          issuedAt: { gte: start, lt: end },
          OR: [
            { enrollment: { path: { tenantId } } },
            { courseEnrollment: { course: { tenantId } } },
          ],
        },
        select: {
          enrollment: { select: { userId: true } },
          courseEnrollment: { select: { userId: true } },
        },
      });
      const certUserIds = [
        ...new Set(
          certs
            .map((c) => c.enrollment?.userId || c.courseEnrollment?.userId)
            .filter((id): id is string => !!id),
        ),
      ];
      const certUsers = await this.prisma.user.findMany({
        where: { id: { in: certUserIds } },
        select: { id: true, country: true, countryCode: true },
      });
      const certUserMap = new Map(certUsers.map((u) => [u.id, u]));
      for (const cert of certs) {
        const uid = cert.enrollment?.userId || cert.courseEnrollment?.userId;
        const u = uid ? certUserMap.get(uid) : undefined;
        if (!u) continue;
        const cc = (u.countryCode || '').toUpperCase() || 'ZZ';
        const cname = u.country || englishCountryNameFromCode(cc) || 'Unknown';
        const k = this.keyCountry(tenantId, cname, cc, '');
        if (!map.has(k)) {
          map.set(k, {
            country: cname,
            countryCode: cc,
            city: '',
            contentViews: 0,
            activeUserIds: new Set(),
            webSessions: 0,
            iosSessions: 0,
            androidSessions: 0,
            newRegistrations: 0,
            courseCompletions: 0,
            pathCompletions: 0,
            certsIssued: 0,
            totalTimeSpentMin: 0,
            quizAttempts: 0,
            quizScoreSum: 0,
            quizScoreCount: 0,
          });
        }
        map.get(k)!.certsIssued += 1;
      }

      const sessions = await this.prisma.userSession.findMany({
        where: {
          tenantId,
          startedAt: { gte: start, lt: end },
          country: { not: null },
        },
        select: {
          durationSeconds: true,
          country: true,
          countryCode: true,
        },
      });
      for (const s of sessions) {
        const cc = (s.countryCode || '').toUpperCase() || 'ZZ';
        const cname = s.country || englishCountryNameFromCode(cc) || 'Unknown';
        const k = this.keyCountry(tenantId, cname, cc, '');
        if (!map.has(k)) {
          map.set(k, {
            country: cname,
            countryCode: cc,
            city: '',
            contentViews: 0,
            activeUserIds: new Set(),
            webSessions: 0,
            iosSessions: 0,
            androidSessions: 0,
            newRegistrations: 0,
            courseCompletions: 0,
            pathCompletions: 0,
            certsIssued: 0,
            totalTimeSpentMin: 0,
            quizAttempts: 0,
            quizScoreSum: 0,
            quizScoreCount: 0,
          });
        }
        map.get(k)!.totalTimeSpentMin += Math.round((s.durationSeconds || 0) / 60);
      }

      for (const agg of map.values()) {
        const activeUsers = agg.activeUserIds.size;
        const avgQuiz =
          agg.quizScoreCount > 0 ? agg.quizScoreSum / agg.quizScoreCount : null;

        await this.prisma.geoAnalyticsRollup.upsert({
          where: {
            tenantId_period_periodStart_country_city: {
              tenantId,
              period,
              periodStart,
              country: agg.country,
              city: agg.city,
            },
          },
          create: {
            tenantId,
            period,
            periodStart,
            country: agg.country,
            countryCode: agg.countryCode,
            city: agg.city,
            activeUsers,
            newRegistrations: agg.newRegistrations,
            contentViews: agg.contentViews,
            courseCompletions: agg.courseCompletions,
            pathCompletions: agg.pathCompletions,
            certsIssued: agg.certsIssued,
            totalTimeSpentMin: agg.totalTimeSpentMin,
            quizAttempts: agg.quizAttempts,
            avgQuizScore: avgQuiz,
            webSessions: agg.webSessions,
            iosSessions: agg.iosSessions,
            androidSessions: agg.androidSessions,
          },
          update: {
            countryCode: agg.countryCode,
            activeUsers,
            newRegistrations: agg.newRegistrations,
            contentViews: agg.contentViews,
            courseCompletions: agg.courseCompletions,
            pathCompletions: agg.pathCompletions,
            certsIssued: agg.certsIssued,
            totalTimeSpentMin: agg.totalTimeSpentMin,
            quizAttempts: agg.quizAttempts,
            avgQuizScore: avgQuiz,
            webSessions: agg.webSessions,
            iosSessions: agg.iosSessions,
            androidSessions: agg.androidSessions,
          },
        });
        totalRows += 1;
      }
    }

    return { rows: totalRows };
  }
}
