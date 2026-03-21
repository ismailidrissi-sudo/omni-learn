import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsFiltersDto } from './dto/analytics-filters.dto';

@Injectable()
export class CsvExportService {
  constructor(private readonly prisma: PrismaService) {}

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
        id: true, title: true, type: true, durationMinutes: true,
        domain: { select: { name: true } },
      },
    });

    const rows = await Promise.all(
      items.map(async (item) => {
        const views = await this.prisma.pageView.count({ where: { contentId: item.id } });
        const uniqueViewers = await this.prisma.pageView.groupBy({ by: ['userId'], where: { contentId: item.id } }).then((r) => r.length);
        const video = await this.prisma.videoWatchProgress.aggregate({
          where: { contentId: item.id },
          _avg: { watchedSeconds: true },
          _sum: { watchedSeconds: true },
        });
        const enrollments = await this.prisma.courseEnrollment.findMany({
          where: { courseId: item.id },
          select: { status: true },
        });
        const completed = enrollments.filter((e) => e.status === 'COMPLETED').length;

        return {
          Title: item.title,
          Type: item.type,
          Domain: item.domain?.name || '',
          Views: views,
          'Unique Viewers': uniqueViewers,
          'Avg Duration (s)': Math.round(video._avg.watchedSeconds || 0),
          'Completion Rate (%)': enrollments.length > 0 ? Math.round((completed / enrollments.length) * 100) : 0,
          'Total Watch Hours': Math.round((video._sum.watchedSeconds || 0) / 3600 * 10) / 10,
        };
      }),
    );

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

  async exportGeo(f: AnalyticsFiltersDto): Promise<string> {
    const where = this.buildSessionWhere(f);
    const groups = await this.prisma.userSession.groupBy({
      by: ['country', 'city'],
      where: { ...where, country: { not: null } },
      _count: true,
      _avg: { durationSeconds: true },
    });

    const rows = groups.map((g) => ({
      Country: g.country || '',
      City: g.city || '',
      Sessions: g._count,
      'Avg Duration (min)': Math.round((g._avg.durationSeconds || 0) / 60),
    }));

    return this.toCsv(['Country', 'City', 'Sessions', 'Avg Duration (min)'], rows);
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
