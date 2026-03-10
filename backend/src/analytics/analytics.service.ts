import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Analytics Service — Advanced analytics dashboard
 * omnilearn.space | Afflatus Consulting Group
 */

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async track(eventType: string, payload: { userId?: string; tenantId?: string; pathId?: string; contentId?: string; [k: string]: unknown }) {
    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return this.prisma.analyticsEvent.create({
      data: {
        eventType,
        userId: payload.userId,
        tenantId: payload.tenantId,
        pathId: payload.pathId,
        contentId: payload.contentId,
        payload: payloadStr,
      },
    });
  }

  async getOverview(tenantId?: string, from?: Date, to?: Date) {
    const where: { tenantId?: string; createdAt?: { gte?: Date; lte?: Date } } = {};
    if (tenantId) where.tenantId = tenantId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = from;
      if (to) where.createdAt.lte = to;
    }

    const [enrollments, completions, events] = await Promise.all([
      this.prisma.analyticsEvent.count({ where: { ...where, eventType: 'ENROLLMENT' } }),
      this.prisma.analyticsEvent.count({ where: { ...where, eventType: 'COMPLETION' } }),
      this.prisma.analyticsEvent.groupBy({
        by: ['eventType'],
        where,
        _count: true,
      }),
    ]);

    const enrollmentsDb = await this.prisma.pathEnrollment.count({
      where: tenantId ? { path: { tenantId } } : undefined,
    });

    const completionsDb = await this.prisma.pathEnrollment.count({
      where: {
        status: 'COMPLETED',
        ...(tenantId ? { path: { tenantId } } : {}),
      },
    });

    return {
      enrollments: enrollments || enrollmentsDb,
      completions: completions || completionsDb,
      eventsByType: events.reduce((acc, e) => ({ ...acc, [e.eventType]: e._count }), {}),
    };
  }

  async getPathAnalytics(pathId: string) {
    const [enrollments, completed, progress] = await Promise.all([
      this.prisma.pathEnrollment.count({ where: { pathId } }),
      this.prisma.pathEnrollment.count({ where: { pathId, status: 'COMPLETED' } }),
      this.prisma.pathEnrollment.aggregate({
        where: { pathId },
        _avg: { progressPct: true },
      }),
    ]);
    return { enrollments, completed, avgProgress: progress._avg.progressPct ?? 0 };
  }

  async getRecentEvents(tenantId?: string, limit = 50) {
    return this.prisma.analyticsEvent.findMany({
      where: tenantId ? { tenantId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
