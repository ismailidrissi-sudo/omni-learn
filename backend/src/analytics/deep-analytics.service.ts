import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ContentType, Prisma } from '@prisma/client';
import { AnalyticsFiltersDto } from './dto/analytics-filters.dto';
import { englishCountryNameFromCode } from './geo-constants';

type VideoAggRow = {
  _sum: { watchedSeconds: number | null };
  _avg: { watchedSeconds: number | null; watchPercentage: number | null };
  _count: number;
};

@Injectable()
export class DeepAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildSessionWhere(f: AnalyticsFiltersDto): Prisma.UserSessionWhereInput {
    const where: Prisma.UserSessionWhereInput = {};
    if (f.from || f.to) {
      where.startedAt = {};
      if (f.from) (where.startedAt as any).gte = new Date(f.from);
      if (f.to) (where.startedAt as any).lte = new Date(f.to);
    }
    if (f.tenantId) where.tenantId = f.tenantId;
    if (f.userId) where.userId = f.userId;
    if (f.country) {
      const code = f.country.trim().toUpperCase();
      if (/^[A-Z]{2}$/.test(code)) {
        where.OR = [{ countryCode: code }, { country: f.country }, { country: code }];
      } else {
        where.country = f.country;
      }
    }
    if (f.deviceType) where.deviceType = f.deviceType as any;
    if (f.gender) where.user = { gender: f.gender as any };
    return where;
  }

  private buildUserWhere(f: AnalyticsFiltersDto): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {};
    if (f.tenantId) where.tenantId = f.tenantId;
    if (f.gender) where.gender = f.gender as any;
    if (f.userId) where.id = f.userId;

    const and: Prisma.UserWhereInput[] = [];
    if (f.search) {
      and.push({
        OR: [
          { name: { contains: f.search, mode: 'insensitive' } },
          { email: { contains: f.search, mode: 'insensitive' } },
        ],
      });
    }
    if (f.country) {
      const code = f.country.trim().toUpperCase();
      if (/^[A-Z]{2}$/.test(code)) {
        and.push({
          OR: [{ countryCode: code }, { country: f.country }, { country: code }],
        });
      } else {
        and.push({ country: f.country });
      }
    }
    if (and.length) where.AND = and;

    return where;
  }

  /** User filter applied to course enrollments in content analytics (matches video / views semantics). */
  private buildEnrollmentUserWhere(f: AnalyticsFiltersDto): Prisma.UserWhereInput | undefined {
    const uw = this.buildUserWhere(f);
    const parts: Prisma.UserWhereInput[] = [];
    if (Object.keys(uw).length) parts.push(uw);
    if (f.deviceType) {
      parts.push({ sessions: { some: { deviceType: f.deviceType as any } } });
    }
    if (!parts.length) return undefined;
    return parts.length === 1 ? parts[0] : { AND: parts };
  }

  private buildPageViewWhereForContent(
    f: AnalyticsFiltersDto,
    contentIds: string[],
    strictViewerUserIds?: string[],
  ): Prisma.PageViewWhereInput {
    const where: Prisma.PageViewWhereInput = {
      contentId: { in: contentIds },
    };
    if (strictViewerUserIds !== undefined) {
      where.userId = { in: strictViewerUserIds };
    }
    const sessionWhere = this.buildSessionWhere(f);
    if (Object.keys(sessionWhere).length > 0) {
      where.session = sessionWhere;
    }
    if (f.from || f.to) {
      where.createdAt = {};
      if (f.from) where.createdAt.gte = new Date(f.from);
      if (f.to) where.createdAt.lte = new Date(f.to);
    }
    return where;
  }

  private buildVideoWatchWhereForContent(
    f: AnalyticsFiltersDto,
    contentIds: string[],
  ): Prisma.VideoWatchProgressWhereInput {
    const where: Prisma.VideoWatchProgressWhereInput = { contentId: { in: contentIds } };
    const uw = this.buildUserWhere(f);
    const parts: Prisma.UserWhereInput[] = [];
    if (Object.keys(uw).length) parts.push(uw);
    if (f.deviceType) {
      parts.push({ sessions: { some: { deviceType: f.deviceType as any } } });
    }
    if (parts.length) {
      where.user = parts.length === 1 ? parts[0] : { AND: parts };
    }
    if (f.from || f.to) {
      where.lastWatchedAt = {};
      if (f.from) where.lastWatchedAt.gte = new Date(f.from);
      if (f.to) where.lastWatchedAt.lte = new Date(f.to);
    }
    return where;
  }

  private buildContentViewEventWhere(
    f: AnalyticsFiltersDto,
    contentIds: string[],
    strictViewerUserIds?: string[],
  ): Prisma.AnalyticsEventWhereInput {
    const where: Prisma.AnalyticsEventWhereInput = {
      eventType: 'CONTENT_VIEW',
      contentId: { in: contentIds },
    };
    if (strictViewerUserIds !== undefined) {
      where.userId = { in: strictViewerUserIds };
    }
    if (f.from || f.to) {
      where.createdAt = {};
      if (f.from) where.createdAt.gte = new Date(f.from);
      if (f.to) where.createdAt.lte = new Date(f.to);
    }
    if (f.tenantId) where.tenantId = f.tenantId;
    return where;
  }

  /** When set, restricts page views / events to users matching gender, country, search, or userId filters. */
  private async resolveStrictViewerUserIds(f: AnalyticsFiltersDto): Promise<string[] | undefined> {
    if (!f.gender && !f.country && !f.search && !f.userId) return undefined;
    const rows = await this.prisma.user.findMany({
      where: this.buildUserWhere(f),
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  mergeCourseVideoMetrics(
    courseId: string,
    lectureIds: string[],
    videoByContent: Map<string, VideoAggRow>,
  ): { sumWatched: number; avgDurationSeconds: number } {
    const direct = videoByContent.get(courseId);
    let sumWatched = Number(direct?._sum?.watchedSeconds) || 0;
    let weightedNum = 0;
    let weightedDen = 0;
    if (direct) {
      const cnt = direct._count;
      const avg = direct._avg?.watchedSeconds ?? 0;
      weightedNum += avg * cnt;
      weightedDen += cnt;
    }
    for (const lid of lectureIds) {
      const v = videoByContent.get(lid);
      if (!v) continue;
      sumWatched += Number(v._sum.watchedSeconds) || 0;
      const cnt = v._count;
      weightedNum += (v._avg?.watchedSeconds ?? 0) * cnt;
      weightedDen += cnt;
    }
    const avgDurationSeconds = weightedDen > 0 ? Math.round(weightedNum / weightedDen) : 0;
    return { sumWatched, avgDurationSeconds };
  }

  /**
   * Shared metrics for admin content table and CSV export: page views + CONTENT_VIEW events,
   * video progress (including lecture roll-up for courses), enrollments with filter-aware users.
   */
  async aggregateContentListMetrics(
    items: Array<{ id: string; type: ContentType }>,
    f: AnalyticsFiltersDto,
  ): Promise<{
    viewsByContent: Map<string, number>;
    uniqueByContent: Map<string, number>;
    videoByContent: Map<string, VideoAggRow>;
    enrollByCourse: Map<string, { total: number; completed: number }>;
    sectionItemIdsByCourse: Map<string, string[]>;
  }> {
    const ids = items.map((i) => i.id);
    const empty = () => ({
      viewsByContent: new Map<string, number>(),
      uniqueByContent: new Map<string, number>(),
      videoByContent: new Map<string, VideoAggRow>(),
      enrollByCourse: new Map<string, { total: number; completed: number }>(),
      sectionItemIdsByCourse: new Map<string, string[]>(),
    });
    if (ids.length === 0) return empty();

    const strictViewerUserIds = await this.resolveStrictViewerUserIds(f);

    const courseIds = items.filter((i) => i.type === ContentType.COURSE).map((i) => i.id);
    const sectionItemIdsByCourse = new Map<string, string[]>();
    if (courseIds.length > 0) {
      const sections = await this.prisma.courseSection.findMany({
        where: { courseId: { in: courseIds } },
        select: {
          courseId: true,
          items: { select: { id: true } },
        },
      });
      for (const sec of sections) {
        const cur = sectionItemIdsByCourse.get(sec.courseId) || [];
        cur.push(...sec.items.map((it) => it.id));
        sectionItemIdsByCourse.set(sec.courseId, cur);
      }
    }

    const lectureIds = [...sectionItemIdsByCourse.values()].flat();
    const expandedVideoIds = [...new Set([...ids, ...lectureIds])];

    const pvWhere = this.buildPageViewWhereForContent(f, ids, strictViewerUserIds);
    const videoWhere = this.buildVideoWatchWhereForContent(f, expandedVideoIds);
    const evWhere = this.buildContentViewEventWhere(f, ids, strictViewerUserIds);

    const enrollWhere: Prisma.CourseEnrollmentWhereInput = { courseId: { in: ids } };
    const enrollUser = this.buildEnrollmentUserWhere(f);
    if (enrollUser) enrollWhere.user = enrollUser;

    const [viewCounts, uniquePairs, videoAggs, enrollGroups, eventCounts, eventUniquePairs] =
      await Promise.all([
        this.prisma.pageView.groupBy({
          by: ['contentId'],
          where: pvWhere,
          _count: true,
        }),
        this.prisma.pageView.groupBy({
          by: ['contentId', 'userId'],
          where: pvWhere,
          _count: true,
        }),
        this.prisma.videoWatchProgress.groupBy({
          by: ['contentId'],
          where: videoWhere,
          _avg: { watchedSeconds: true, watchPercentage: true },
          _sum: { watchedSeconds: true },
          _count: true,
        }),
        this.prisma.courseEnrollment.groupBy({
          by: ['courseId', 'status'],
          where: enrollWhere,
          _count: true,
        }),
        this.prisma.analyticsEvent.groupBy({
          by: ['contentId'],
          where: evWhere,
          _count: true,
        }),
        this.prisma.analyticsEvent.groupBy({
          by: ['contentId', 'userId'],
          where: { ...evWhere, userId: { not: null } },
          _count: true,
        }),
      ]);

    const viewsByContent = new Map<string, number>();
    for (const row of viewCounts) {
      if (row.contentId) viewsByContent.set(row.contentId, row._count);
    }
    for (const row of eventCounts) {
      if (!row.contentId) continue;
      viewsByContent.set(row.contentId, (viewsByContent.get(row.contentId) || 0) + row._count);
    }

    const uniqueSets = new Map<string, Set<string>>();
    const addUnique = (contentId: string, userId: string | null) => {
      if (!userId) return;
      if (!uniqueSets.has(contentId)) uniqueSets.set(contentId, new Set());
      uniqueSets.get(contentId)!.add(userId);
    };
    for (const row of uniquePairs) {
      if (row.contentId) addUnique(row.contentId, row.userId);
    }
    for (const row of eventUniquePairs) {
      if (row.contentId) addUnique(row.contentId, row.userId);
    }
    const uniqueByContent = new Map<string, number>();
    for (const [cid, set] of uniqueSets) {
      uniqueByContent.set(cid, set.size);
    }

    const videoByContent = new Map<string, VideoAggRow>();
    for (const v of videoAggs) {
      if (v.contentId == null) continue;
      const cnt = typeof v._count === 'number' ? v._count : (v._count as { _all?: number })._all ?? 0;
      videoByContent.set(v.contentId, {
        _sum: v._sum,
        _avg: v._avg,
        _count: cnt,
      });
    }

    const enrollByCourse = new Map<string, { total: number; completed: number }>();
    for (const row of enrollGroups) {
      if (!row.courseId) continue;
      const cur = enrollByCourse.get(row.courseId) || { total: 0, completed: 0 };
      cur.total += row._count;
      if (row.status === 'COMPLETED') cur.completed += row._count;
      enrollByCourse.set(row.courseId, cur);
    }

    return {
      viewsByContent,
      uniqueByContent,
      videoByContent,
      enrollByCourse,
      sectionItemIdsByCourse,
    };
  }

  async getDashboardOverview(f: AnalyticsFiltersDto) {
    const sessionWhere = this.buildSessionWhere(f);
    const userWhere = this.buildUserWhere(f);

    const dateFilter: any = {};
    if (f.from || f.to) {
      dateFilter.createdAt = {};
      if (f.from) dateFilter.createdAt.gte = new Date(f.from);
      if (f.to) dateFilter.createdAt.lte = new Date(f.to);
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      newUsers,
      totalSessions,
      avgSession,
      totalPageViews,
      pathEnrollments,
      pathCompletions,
      courseEnrollments,
      courseCompletions,
      totalWatchSeconds,
    ] = await Promise.all([
      this.prisma.user.count({ where: userWhere }),
      this.prisma.userSession.groupBy({
        by: ['userId'],
        where: { ...sessionWhere, startedAt: { gte: thirtyDaysAgo } },
      }).then((r) => r.length),
      this.prisma.user.count({
        where: { ...userWhere, ...dateFilter },
      }),
      this.prisma.userSession.count({ where: sessionWhere }),
      this.prisma.userSession.aggregate({
        where: sessionWhere,
        _avg: { durationSeconds: true },
      }),
      this.prisma.pageView.count({
        where: {
          session: sessionWhere,
          ...(f.from || f.to ? { createdAt: dateFilter.createdAt } : {}),
        },
      }),
      this.prisma.pathEnrollment.count({
        where: f.tenantId ? { path: { tenantId: f.tenantId } } : undefined,
      }),
      this.prisma.pathEnrollment.count({
        where: {
          status: 'COMPLETED',
          ...(f.tenantId ? { path: { tenantId: f.tenantId } } : {}),
        },
      }),
      this.prisma.courseEnrollment.count({
        where: f.tenantId
          ? { course: { tenantId: f.tenantId } }
          : undefined,
      }),
      this.prisma.courseEnrollment.count({
        where: {
          status: 'COMPLETED',
          ...(f.tenantId ? { course: { tenantId: f.tenantId } } : {}),
        },
      }),
      this.prisma.videoWatchProgress.aggregate({
        _sum: { watchedSeconds: true },
      }),
    ]);

    const totalEnrollments = pathEnrollments + courseEnrollments;
    const totalCompletions = pathCompletions + courseCompletions;
    const completionRate = totalEnrollments > 0 ? Math.round((totalCompletions / totalEnrollments) * 100) : 0;
    const totalLearningHours = Math.round(((totalWatchSeconds._sum.watchedSeconds || 0) + (avgSession._avg.durationSeconds || 0) * totalSessions) / 3600);

    return {
      totalUsers,
      activeUsers,
      newUsers,
      totalSessions,
      avgSessionDuration: Math.round(avgSession._avg.durationSeconds || 0),
      totalPageViews,
      totalEnrollments,
      totalCompletions,
      completionRate,
      totalLearningHours,
    };
  }

  async getUsersList(f: AnalyticsFiltersDto) {
    const page = f.page || 1;
    const limit = f.limit || 25;
    const skip = (page - 1) * limit;
    const userWhere = this.buildUserWhere(f);

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: userWhere,
        skip,
        take: limit,
        orderBy: f.sortBy
          ? { [f.sortBy]: f.sortOrder || 'desc' }
          : { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          tenantId: true,
          gender: true,
          country: true,
          city: true,
          dateOfBirth: true,
          planId: true,
          userType: true,
          createdAt: true,
          tenant: { select: { name: true, slug: true } },
        },
      }),
      this.prisma.user.count({ where: userWhere }),
    ]);

    const enriched = await Promise.all(
      users.map(async (u) => {
        const [sessions, pathEnrollments, courseEnrollments] = await Promise.all([
          this.prisma.userSession.aggregate({
            where: { userId: u.id },
            _count: true,
            _sum: { durationSeconds: true },
            _max: { startedAt: true },
          }),
          this.prisma.pathEnrollment.findMany({
            where: { userId: u.id },
            select: { status: true },
          }),
          this.prisma.courseEnrollment.findMany({
            where: { userId: u.id },
            select: { status: true },
          }),
        ]);

        const allEnrollments = [...pathEnrollments, ...courseEnrollments];
        const completed = allEnrollments.filter((e) => e.status === 'COMPLETED').length;
        const completionRate = allEnrollments.length > 0 ? Math.round((completed / allEnrollments.length) * 100) : 0;

        const lastSession = await this.prisma.userSession.findFirst({
          where: { userId: u.id },
          orderBy: { startedAt: 'desc' },
          select: { deviceType: true },
        });

        return {
          ...u,
          tenantName: u.tenant?.name || null,
          sessionsCount: sessions._count,
          totalDurationSeconds: sessions._sum.durationSeconds || 0,
          lastActive: sessions._max.startedAt || u.createdAt,
          enrollments: allEnrollments.length,
          completionRate,
          primaryDevice: lastSession?.deviceType || 'UNKNOWN',
        };
      }),
    );

    return { users: enriched, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getContentList(f: AnalyticsFiltersDto) {
    const page = f.page || 1;
    const limit = f.limit || 25;
    const skip = (page - 1) * limit;

    const where: Prisma.ContentItemWhereInput = {};
    if (f.tenantId) where.tenantId = f.tenantId;
    if (f.domainId) where.domainId = f.domainId;
    if (f.courseId) where.id = f.courseId;

    const [items, total] = await Promise.all([
      this.prisma.contentItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          type: true,
          domainId: true,
          durationMinutes: true,
          createdAt: true,
          domain: { select: { name: true } },
        },
      }),
      this.prisma.contentItem.count({ where }),
    ]);

    const ids = items.map((i) => i.id);
    if (ids.length === 0) {
      return { content: [], total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    const { viewsByContent, uniqueByContent, videoByContent, enrollByCourse, sectionItemIdsByCourse } =
      await this.aggregateContentListMetrics(items, f);

    const enriched = items.map((item) => {
      const enroll = enrollByCourse.get(item.id);
      const completionRate =
        enroll && enroll.total > 0 ? Math.round((enroll.completed / enroll.total) * 100) : 0;
      let sumWatched: number;
      let avgDurationSeconds: number;
      if (item.type === ContentType.COURSE) {
        const lecIds = sectionItemIdsByCourse.get(item.id) || [];
        const m = this.mergeCourseVideoMetrics(item.id, lecIds, videoByContent);
        sumWatched = m.sumWatched;
        avgDurationSeconds = m.avgDurationSeconds;
      } else {
        const v = videoByContent.get(item.id);
        sumWatched = Number(v?._sum?.watchedSeconds) || 0;
        avgDurationSeconds = Math.round(v?._avg?.watchedSeconds || 0);
      }
      return {
        ...item,
        domainName: item.domain?.name || null,
        views: viewsByContent.get(item.id) ?? 0,
        uniqueViewers: uniqueByContent.get(item.id) ?? 0,
        avgDurationSeconds,
        completionRate,
        totalWatchHours: Math.round(((Number(sumWatched) || 0) / 3600) * 10) / 10,
      };
    });

    return { content: enriched, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getDeviceBreakdown(f: AnalyticsFiltersDto) {
    const where = this.buildSessionWhere(f);
    const groups = await this.prisma.userSession.groupBy({
      by: ['deviceType'],
      where,
      _count: true,
    });

    const total = groups.reduce((sum, g) => sum + g._count, 0);
    return groups.map((g) => ({
      deviceType: g.deviceType,
      count: g._count,
      percentage: total > 0 ? Math.round((g._count / total) * 100) : 0,
    }));
  }

  async getGeographicData(f: AnalyticsFiltersDto) {
    const where = this.buildSessionWhere(f);

    const countryGroups = await this.prisma.userSession.groupBy({
      by: ['country', 'countryCode'],
      where: { ...where, country: { not: null } },
      _count: true,
    });

    const locations = await this.prisma.userSession.findMany({
      where: { ...where, latitude: { not: null } },
      select: { latitude: true, longitude: true, city: true, country: true, userId: true },
      distinct: ['userId'],
    });

    return {
      countries: countryGroups
        .map((g) => {
          const cc = (g.countryCode || '').toUpperCase();
          return {
            country: englishCountryNameFromCode(cc) || g.country || '',
            countryCode: cc || null,
            sessions: g._count,
          };
        })
        .filter((c) => c.countryCode)
        .sort((a, b) => b.sessions - a.sessions),
      locations: locations.map((l) => ({
        lat: l.latitude,
        lng: l.longitude,
        city: l.city,
        country: l.country,
      })),
    };
  }

  async getSessionTimeline(f: AnalyticsFiltersDto) {
    const where = this.buildSessionWhere(f);
    const sessions = await this.prisma.userSession.findMany({
      where,
      select: { startedAt: true },
      orderBy: { startedAt: 'asc' },
    });

    const daily: Record<string, number> = {};
    for (const s of sessions) {
      const day = s.startedAt.toISOString().slice(0, 10);
      daily[day] = (daily[day] || 0) + 1;
    }

    return Object.entries(daily).map(([date, count]) => ({ date, sessions: count }));
  }

  async getUserActivityHeatmap(f: AnalyticsFiltersDto) {
    const where = this.buildSessionWhere(f);
    const sessions = await this.prisma.userSession.findMany({
      where,
      select: { startedAt: true },
    });

    const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const s of sessions) {
      const day = s.startedAt.getUTCDay();
      const hour = s.startedAt.getUTCHours();
      heatmap[day][hour]++;
    }

    return heatmap;
  }

  async getDemographicsBreakdown(f: AnalyticsFiltersDto) {
    const userWhere = this.buildUserWhere(f);

    const [genderGroups, planGroups, typeGroups, users] = await Promise.all([
      this.prisma.user.groupBy({ by: ['gender'], where: userWhere, _count: true }),
      this.prisma.user.groupBy({ by: ['planId'], where: userWhere, _count: true }),
      this.prisma.user.groupBy({ by: ['userType'], where: userWhere, _count: true }),
      this.prisma.user.findMany({
        where: userWhere,
        select: { dateOfBirth: true },
      }),
    ]);

    const languageGroups = await this.prisma.userSession.groupBy({
      by: ['language'],
      where: { ...this.buildSessionWhere(f), language: { not: null } },
      _count: true,
    });

    const now = new Date();
    const ageBuckets: Record<string, number> = { 'Under 18': 0, '18-24': 0, '25-34': 0, '35-44': 0, '45-54': 0, '55-64': 0, '65+': 0, 'Unknown': 0 };
    for (const u of users) {
      if (!u.dateOfBirth) { ageBuckets['Unknown']++; continue; }
      const age = Math.floor((now.getTime() - u.dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      if (age < 18) ageBuckets['Under 18']++;
      else if (age <= 24) ageBuckets['18-24']++;
      else if (age <= 34) ageBuckets['25-34']++;
      else if (age <= 44) ageBuckets['35-44']++;
      else if (age <= 54) ageBuckets['45-54']++;
      else if (age <= 64) ageBuckets['55-64']++;
      else ageBuckets['65+']++;
    }

    return {
      gender: genderGroups.map((g) => ({ gender: g.gender || 'Not specified', count: g._count })),
      age: Object.entries(ageBuckets).map(([bracket, count]) => ({ bracket, count })),
      languages: languageGroups.map((g) => ({ language: g.language, count: g._count })).sort((a, b) => b.count - a.count),
      plans: planGroups.map((g) => ({ plan: g.planId, count: g._count })),
      userTypes: typeGroups.map((g) => ({ type: g.userType || 'Not set', count: g._count })),
    };
  }

  async getCompletionFunnel(f: AnalyticsFiltersDto) {
    const tenantFilter = f.tenantId ? { path: { tenantId: f.tenantId } } : {};

    const [enrolled, started, halfDone, completed] = await Promise.all([
      this.prisma.pathEnrollment.count({ where: tenantFilter }),
      this.prisma.pathEnrollment.count({ where: { ...tenantFilter, progressPct: { gt: 0 } } }),
      this.prisma.pathEnrollment.count({ where: { ...tenantFilter, progressPct: { gte: 50 } } }),
      this.prisma.pathEnrollment.count({ where: { ...tenantFilter, status: 'COMPLETED' } }),
    ]);

    return [
      { stage: 'Enrolled', count: enrolled },
      { stage: 'Started (>0%)', count: started },
      { stage: 'Halfway (≥50%)', count: halfDone },
      { stage: 'Completed', count: completed },
    ];
  }

  async getLearningVelocity(f: AnalyticsFiltersDto) {
    const enrollments = await this.prisma.courseEnrollment.findMany({
      where: {
        status: 'COMPLETED',
        completedAt: { not: null },
        ...(f.tenantId ? { course: { tenantId: f.tenantId } } : {}),
      },
      select: {
        courseId: true,
        createdAt: true,
        completedAt: true,
        course: { select: { title: true } },
      },
    });

    const courseVelocity: Record<string, { title: string; totalDays: number; count: number }> = {};
    for (const e of enrollments) {
      if (!e.completedAt) continue;
      const days = Math.ceil((e.completedAt.getTime() - e.createdAt.getTime()) / (24 * 60 * 60 * 1000));
      if (!courseVelocity[e.courseId]) {
        courseVelocity[e.courseId] = { title: e.course.title, totalDays: 0, count: 0 };
      }
      courseVelocity[e.courseId].totalDays += days;
      courseVelocity[e.courseId].count++;
    }

    return Object.entries(courseVelocity).map(([courseId, data]) => ({
      courseId,
      title: data.title,
      avgDaysToComplete: Math.round(data.totalDays / data.count),
      completions: data.count,
    })).sort((a, b) => b.completions - a.completions);
  }

  async getRetentionCohorts(f: AnalyticsFiltersDto) {
    const sessions = await this.prisma.userSession.findMany({
      where: this.buildSessionWhere(f),
      select: { userId: true, startedAt: true },
      orderBy: { startedAt: 'asc' },
    });

    const users = await this.prisma.user.findMany({
      where: this.buildUserWhere(f),
      select: { id: true, createdAt: true },
    });

    const userSignupMonth: Record<string, string> = {};
    for (const u of users) {
      userSignupMonth[u.id] = u.createdAt.toISOString().slice(0, 7);
    }

    const cohorts: Record<string, Record<string, Set<string>>> = {};
    for (const s of sessions) {
      const signupMonth = userSignupMonth[s.userId];
      if (!signupMonth) continue;
      const activityMonth = s.startedAt.toISOString().slice(0, 7);
      if (!cohorts[signupMonth]) cohorts[signupMonth] = {};
      if (!cohorts[signupMonth][activityMonth]) cohorts[signupMonth][activityMonth] = new Set();
      cohorts[signupMonth][activityMonth].add(s.userId);
    }

    return Object.entries(cohorts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([signupMonth, months]) => ({
        cohort: signupMonth,
        months: Object.entries(months)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, userSet]) => ({ month, users: userSet.size })),
      }));
  }

  async getContentDropoff(courseId: string) {
    const sections = await this.prisma.courseSection.findMany({
      where: { courseId },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        title: true,
        sortOrder: true,
        items: {
          select: {
            id: true,
            title: true,
            sortOrder: true,
            progress: { select: { status: true } },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    return sections.map((s) => ({
      sectionId: s.id,
      title: s.title,
      sortOrder: s.sortOrder,
      items: s.items.map((item) => {
        const total = item.progress.length;
        const completed = item.progress.filter((p) => p.status === 'COMPLETED').length;
        return {
          itemId: item.id,
          title: item.title,
          totalStarted: total,
          completed,
          completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        };
      }),
    }));
  }

  async getBrowserOSBreakdown(f: AnalyticsFiltersDto) {
    const where = this.buildSessionWhere(f);

    const [browsers, oses] = await Promise.all([
      this.prisma.userSession.groupBy({
        by: ['browserName'],
        where: { ...where, browserName: { not: null } },
        _count: true,
      }),
      this.prisma.userSession.groupBy({
        by: ['osName'],
        where: { ...where, osName: { not: null } },
        _count: true,
      }),
    ]);

    return {
      browsers: browsers.map((b) => ({ name: b.browserName, count: b._count })).sort((a, b) => b.count - a.count),
      operatingSystems: oses.map((o) => ({ name: o.osName, count: o._count })).sort((a, b) => b.count - a.count),
    };
  }

  async getTopContent(f: AnalyticsFiltersDto, limit = 10) {
    const sessionWhere = this.buildSessionWhere(f);
    const groups = await this.prisma.pageView.groupBy({
      by: ['contentId'],
      where: {
        contentId: { not: null },
        session: sessionWhere,
      },
      _count: true,
      orderBy: { _count: { contentId: 'desc' } },
      take: limit,
    });

    const items = await Promise.all(
      groups.map(async (g) => {
        const content = await this.prisma.contentItem.findUnique({
          where: { id: g.contentId! },
          select: { id: true, title: true, type: true },
        });
        return { contentId: g.contentId, title: content?.title || 'Unknown', type: content?.type, views: g._count };
      }),
    );

    return items;
  }
}
