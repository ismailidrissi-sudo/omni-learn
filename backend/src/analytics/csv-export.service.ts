import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { ContentType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsFiltersDto } from './dto/analytics-filters.dto';
import { DeepAnalyticsService } from './deep-analytics.service';

@Injectable()
export class CsvExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly deepAnalytics: DeepAnalyticsService,
  ) {}

  private escapeCsv(value: unknown): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  private toCsv(headers: string[], rows: Record<string, unknown>[]): string {
    const headerLine = headers.map((h) => this.escapeCsv(h)).join(',');
    const dataLines = rows.map((row) =>
      headers.map((h) => this.escapeCsv(row[h])).join(','),
    );
    return [headerLine, ...dataLines].join('\n');
  }

  async exportUsers(f: AnalyticsFiltersDto): Promise<string> {
    const userWhere = this.buildUserWhere(f);
    const users = await this.prisma.user.findMany({
      where: userWhere,
      select: {
        id: true, name: true, email: true, gender: true, country: true,
        city: true, dateOfBirth: true, planId: true, userType: true,
        createdAt: true,
        tenant: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const rows = await Promise.all(
      users.map(async (u) => {
        const sessions = await this.prisma.userSession.aggregate({
          where: { userId: u.id },
          _count: true,
          _sum: { durationSeconds: true },
          _max: { startedAt: true },
        });
        const enrollments = await this.prisma.pathEnrollment.count({ where: { userId: u.id } });
        const courseEnrolls = await this.prisma.courseEnrollment.count({ where: { userId: u.id } });
        const completedPaths = await this.prisma.pathEnrollment.count({ where: { userId: u.id, status: 'COMPLETED' } });
        const completedCourses = await this.prisma.courseEnrollment.count({ where: { userId: u.id, status: 'COMPLETED' } });
        const total = enrollments + courseEnrolls;
        const completed = completedPaths + completedCourses;

        const lastSession = await this.prisma.userSession.findFirst({
          where: { userId: u.id },
          orderBy: { startedAt: 'desc' },
          select: { deviceType: true, country: true },
        });

        return {
          Name: u.name,
          Email: u.email,
          Company: u.tenant?.name || '',
          Gender: u.gender || '',
          Country: u.country || lastSession?.country || '',
          City: u.city || '',
          'Date of Birth': u.dateOfBirth ? u.dateOfBirth.toISOString().slice(0, 10) : '',
          Plan: u.planId,
          'User Type': u.userType || '',
          Sessions: sessions._count,
          'Total Duration (min)': Math.round((sessions._sum.durationSeconds || 0) / 60),
          'Last Active': sessions._max.startedAt ? sessions._max.startedAt.toISOString() : '',
          Enrollments: total,
          Completed: completed,
          'Completion Rate (%)': total > 0 ? Math.round((completed / total) * 100) : 0,
          'Primary Device': lastSession?.deviceType || '',
          'Joined At': u.createdAt.toISOString().slice(0, 10),
        };
      }),
    );

    const headers = ['Name', 'Email', 'Company', 'Gender', 'Country', 'City', 'Date of Birth',
      'Plan', 'User Type', 'Sessions', 'Total Duration (min)', 'Last Active',
      'Enrollments', 'Completed', 'Completion Rate (%)', 'Primary Device', 'Joined At'];
    return this.toCsv(headers, rows);
  }

  async exportContent(f: AnalyticsFiltersDto): Promise<string> {
    const where: any = {};
    if (f.tenantId) where.tenantId = f.tenantId;
    if (f.domainId) where.domainId = f.domainId;

    const items = await this.prisma.contentItem.findMany({
      where,
      select: {
        id: true,
        title: true,
        type: true,
        durationMinutes: true,
        domain: { select: { name: true } },
      },
    });

    const metrics = await this.deepAnalytics.aggregateContentListMetrics(items, f);

    const rows = items.map((item) => {
      const enroll = metrics.enrollByCourse.get(item.id);
      const completionRate =
        enroll && enroll.total > 0 ? Math.round((enroll.completed / enroll.total) * 100) : 0;
      let sumWatched: number;
      let avgDurationSeconds: number;
      if (item.type === ContentType.COURSE) {
        const lecIds = metrics.sectionItemIdsByCourse.get(item.id) || [];
        const m = this.deepAnalytics.mergeCourseVideoMetrics(item.id, lecIds, metrics.videoByContent);
        sumWatched = m.sumWatched;
        avgDurationSeconds = m.avgDurationSeconds;
      } else {
        const v = metrics.videoByContent.get(item.id);
        sumWatched = Number(v?._sum?.watchedSeconds) || 0;
        avgDurationSeconds = Math.round(v?._avg?.watchedSeconds || 0);
      }

      return {
        Title: item.title,
        Type: item.type,
        Domain: item.domain?.name || '',
        Views: metrics.viewsByContent.get(item.id) ?? 0,
        'Unique Viewers': metrics.uniqueByContent.get(item.id) ?? 0,
        'Avg Duration (s)': avgDurationSeconds,
        'Completion Rate (%)': completionRate,
        'Total Watch Hours': Math.round((sumWatched / 3600) * 10) / 10,
      };
    });

    const headers = ['Title', 'Type', 'Domain', 'Views', 'Unique Viewers', 'Avg Duration (s)', 'Completion Rate (%)', 'Total Watch Hours'];
    return this.toCsv(headers, rows);
  }

  async exportSessions(f: AnalyticsFiltersDto): Promise<string> {
    const where = this.buildSessionWhere(f);
    const sessions = await this.prisma.userSession.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
        _count: { select: { pageViews: true } },
      },
    });

    const rows = sessions.map((s) => ({
      User: s.user.name,
      Email: s.user.email,
      Device: s.deviceType,
      Browser: s.browserName || '',
      OS: s.osName || '',
      IP: s.ipAddress || '',
      Country: s.country || '',
      City: s.city || '',
      Language: s.language || '',
      'Screen Resolution': s.screenResolution || '',
      'Started At': s.startedAt.toISOString(),
      'Ended At': s.endedAt ? s.endedAt.toISOString() : '',
      'Duration (min)': Math.round(s.durationSeconds / 60),
      'Page Views': s._count.pageViews,
      Fingerprint: s.fingerprint || '',
    }));

    const headers = ['User', 'Email', 'Device', 'Browser', 'OS', 'IP', 'Country', 'City', 'Language',
      'Screen Resolution', 'Started At', 'Ended At', 'Duration (min)', 'Page Views', 'Fingerprint'];
    return this.toCsv(headers, rows);
  }

  private buildContentLogWhere(f: AnalyticsFiltersDto): Prisma.ContentAccessLogWhereInput {
    const userFilter: Prisma.UserWhereInput = {};
    if (f.tenantId) userFilter.tenantId = f.tenantId;
    const where: Prisma.ContentAccessLogWhereInput = { user: userFilter };
    if (f.from || f.to) {
      where.createdAt = {};
      if (f.from) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(f.from);
      if (f.to) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(f.to);
    }
    return where;
  }

  /** Country-level merge: sessions + content views (full English country names in CSV). */
  async exportGeo(f: AnalyticsFiltersDto): Promise<string> {
    const where = this.buildSessionWhere(f);
    const [sessionCountry, logsCountry, sessionCity] = await Promise.all([
      this.prisma.userSession.groupBy({
        by: ['country', 'countryCode'],
        where: { ...where, country: { not: null } },
        _count: true,
        _avg: { durationSeconds: true },
      }),
      this.prisma.contentAccessLog.groupBy({
        by: ['country', 'countryCode'],
        where: { ...this.buildContentLogWhere(f), country: { not: null } },
        _count: true,
      }),
      this.prisma.userSession.groupBy({
        by: ['country', 'city'],
        where: { ...where, country: { not: null }, city: { not: null } },
        _count: true,
        _avg: { durationSeconds: true },
      }),
    ]);

    const byCode = new Map<
      string,
      { country: string; sessions: number; contentViews: number; avgMin: number; n: number }
    >();
    for (const g of sessionCountry) {
      const code = (g.countryCode || '').toUpperCase() || '_';
      byCode.set(code, {
        country: g.country || '',
        sessions: g._count,
        contentViews: 0,
        avgMin: Math.round((g._avg.durationSeconds || 0) / 60),
        n: 1,
      });
    }
    for (const g of logsCountry) {
      const code = (g.countryCode || '').toUpperCase() || '_';
      const cur = byCode.get(code);
      if (cur) cur.contentViews = g._count;
      else {
        byCode.set(code, {
          country: g.country || '',
          sessions: 0,
          contentViews: g._count,
          avgMin: 0,
          n: 0,
        });
      }
    }

    const countryRows = [...byCode.entries()]
      .filter(([code]) => code !== '_')
      .map(([, v]) => ({
        Country: v.country,
        Sessions: v.sessions,
        'Content views': v.contentViews,
        'Avg session (min)': v.avgMin,
      }))
      .sort((a, b) => b.Sessions + b['Content views'] - (a.Sessions + a['Content views']));

    const cityRows = sessionCity.map((g) => ({
      Country: g.country || '',
      City: g.city || '',
      Sessions: g._count,
      'Avg Duration (min)': Math.round((g._avg.durationSeconds || 0) / 60),
    }));

    const a = this.toCsv(['Country', 'Sessions', 'Content views', 'Avg session (min)'], countryRows);
    const b = this.toCsv(['Country', 'City', 'Sessions', 'Avg Duration (min)'], cityRows);
    return `=== By country ===\n${a}\n\n=== By city (sessions) ===\n${b}`;
  }

  async buildGeoExcelBuffer(f: AnalyticsFiltersDto): Promise<Buffer> {
    const csvBlock = await this.exportGeo(f);
    const wb = new ExcelJS.Workbook();
    const countrySheet = wb.addWorksheet('Countries');
    countrySheet.addRow(['Country', 'Sessions', 'Content views', 'Avg session (min)']);
    const sessionWhere = this.buildSessionWhere(f);
    const sessionCountry = await this.prisma.userSession.groupBy({
      by: ['country', 'countryCode'],
      where: { ...sessionWhere, country: { not: null } },
      _count: true,
      _avg: { durationSeconds: true },
    });
    const logsCountry = await this.prisma.contentAccessLog.groupBy({
      by: ['country', 'countryCode'],
      where: { ...this.buildContentLogWhere(f), country: { not: null } },
      _count: true,
    });
    const map = new Map<string, { country: string; s: number; v: number; avg: number }>();
    for (const g of sessionCountry) {
      const c = (g.countryCode || '').toUpperCase();
      map.set(c, {
        country: g.country || '',
        s: g._count,
        v: 0,
        avg: Math.round((g._avg.durationSeconds || 0) / 60),
      });
    }
    for (const g of logsCountry) {
      const c = (g.countryCode || '').toUpperCase();
      const x = map.get(c);
      if (x) x.v = g._count;
      else map.set(c, { country: g.country || '', s: 0, v: g._count, avg: 0 });
    }
    for (const [, v] of map) {
      countrySheet.addRow([v.country, v.s, v.v, v.avg]);
    }

    const citySheet = wb.addWorksheet('Cities');
    citySheet.addRow(['Country', 'City', 'Sessions', 'Avg Duration (min)']);
    const sessionCity = await this.prisma.userSession.groupBy({
      by: ['country', 'city'],
      where: { ...sessionWhere, country: { not: null }, city: { not: null } },
      _count: true,
      _avg: { durationSeconds: true },
    });
    for (const g of sessionCity) {
      citySheet.addRow([
        g.country,
        g.city,
        g._count,
        Math.round((g._avg.durationSeconds || 0) / 60),
      ]);
    }

    const notes = wb.addWorksheet('Export notes');
    notes.addRow(['Generated from filters', JSON.stringify(f)]);
    notes.addRow(['Raw combined CSV preview', csvBlock.slice(0, 5000)]);

    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async buildGeoPdfBuffer(f: AnalyticsFiltersDto): Promise<Buffer> {
    const sessionWhere = this.buildSessionWhere(f);
    const sessionCountry = await this.prisma.userSession.groupBy({
      by: ['country', 'countryCode'],
      where: { ...sessionWhere, country: { not: null } },
      _count: true,
    });
    const top = sessionCountry.sort((a, b) => b._count - a._count).slice(0, 15);

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ margin: 50 });
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(18).text('Geographic analytics summary', { underline: true });
      doc.moveDown();
      doc.fontSize(10).text(`Period: ${f.from || '—'} to ${f.to || '—'}  Tenant: ${f.tenantId || 'all'}`);
      doc.moveDown();
      doc.fontSize(12).text('Top countries by sessions');
      doc.moveDown(0.5);
      top.forEach((row, i) => {
        doc.fontSize(10).text(`${i + 1}. ${row.country} — ${row._count} sessions`);
      });
      doc.end();
    });
  }

  async exportDemographics(f: AnalyticsFiltersDto): Promise<string> {
    const userWhere = this.buildUserWhere(f);
    const users = await this.prisma.user.findMany({
      where: userWhere,
      select: {
        name: true, email: true, gender: true, dateOfBirth: true,
        country: true, planId: true, userType: true,
      },
    });

    const sessionLanguages = await this.prisma.userSession.findMany({
      where: this.buildSessionWhere(f),
      select: { userId: true, language: true },
      distinct: ['userId'],
    });
    const langMap: Record<string, string> = {};
    for (const s of sessionLanguages) {
      langMap[s.userId] = s.language || '';
    }

    const now = new Date();
    const rows = users.map((u) => {
      let ageBracket = 'Unknown';
      if (u.dateOfBirth) {
        const age = Math.floor((now.getTime() - u.dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        if (age < 18) ageBracket = 'Under 18';
        else if (age <= 24) ageBracket = '18-24';
        else if (age <= 34) ageBracket = '25-34';
        else if (age <= 44) ageBracket = '35-44';
        else if (age <= 54) ageBracket = '45-54';
        else if (age <= 64) ageBracket = '55-64';
        else ageBracket = '65+';
      }

      return {
        Name: u.name,
        Email: u.email,
        Gender: u.gender || 'Not specified',
        'Age Bracket': ageBracket,
        Country: u.country || '',
        Plan: u.planId,
        'User Type': u.userType || '',
      };
    });

    return this.toCsv(['Name', 'Email', 'Gender', 'Age Bracket', 'Country', 'Plan', 'User Type'], rows);
  }

  async exportFull(f: AnalyticsFiltersDto): Promise<string> {
    const where = this.buildSessionWhere(f);
    const sessions = await this.prisma.userSession.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      include: {
        user: {
          select: {
            name: true, email: true, gender: true, country: true,
            city: true, dateOfBirth: true, planId: true, userType: true,
            tenant: { select: { name: true } },
          },
        },
        _count: { select: { pageViews: true } },
      },
    });

    const rows = sessions.map((s) => ({
      'User Name': s.user.name,
      'User Email': s.user.email,
      Company: s.user.tenant?.name || '',
      Gender: s.user.gender || '',
      'User Country': s.user.country || '',
      'User City': s.user.city || '',
      Plan: s.user.planId,
      'User Type': s.user.userType || '',
      'Session ID': s.id,
      Device: s.deviceType,
      Browser: `${s.browserName || ''} ${s.browserVersion || ''}`.trim(),
      OS: `${s.osName || ''} ${s.osVersion || ''}`.trim(),
      IP: s.ipAddress || '',
      'Session Country': s.country || '',
      'Session City': s.city || '',
      Language: s.language || '',
      'Screen Resolution': s.screenResolution || '',
      Fingerprint: s.fingerprint || '',
      'Started At': s.startedAt.toISOString(),
      'Ended At': s.endedAt ? s.endedAt.toISOString() : '',
      'Duration (min)': Math.round(s.durationSeconds / 60),
      'Page Views': s._count.pageViews,
    }));

    const headers = ['User Name', 'User Email', 'Company', 'Gender', 'User Country', 'User City',
      'Plan', 'User Type', 'Session ID', 'Device', 'Browser', 'OS', 'IP',
      'Session Country', 'Session City', 'Language', 'Screen Resolution', 'Fingerprint',
      'Started At', 'Ended At', 'Duration (min)', 'Page Views'];
    return this.toCsv(headers, rows);
  }

  private buildSessionWhere(f: AnalyticsFiltersDto): any {
    const where: any = {};
    if (f.from || f.to) {
      where.startedAt = {};
      if (f.from) where.startedAt.gte = new Date(f.from);
      if (f.to) where.startedAt.lte = new Date(f.to);
    }
    if (f.tenantId) where.tenantId = f.tenantId;
    if (f.userId) where.userId = f.userId;
    if (f.country) where.country = f.country;
    if (f.deviceType) where.deviceType = f.deviceType;
    return where;
  }

  private buildUserWhere(f: AnalyticsFiltersDto): any {
    const where: any = {};
    if (f.tenantId) where.tenantId = f.tenantId;
    if (f.gender) where.gender = f.gender;
    if (f.country) where.country = f.country;
    if (f.userId) where.id = f.userId;
    if (f.search) {
      where.OR = [
        { name: { contains: f.search, mode: 'insensitive' } },
        { email: { contains: f.search, mode: 'insensitive' } },
      ];
    }
    return where;
  }
}
