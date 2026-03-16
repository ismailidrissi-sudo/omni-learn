import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReferralAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(tenantId?: string, from?: Date, to?: Date) {
    const dateFilter: Record<string, unknown> = {};
    if (from) dateFilter.gte = from;
    if (to) dateFilter.lte = to;
    const dateWhere = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

    const referrerFilter: Record<string, unknown> = { ...dateWhere };
    if (tenantId) {
      const tenantUsers = await this.prisma.user.findMany({
        where: { tenantId },
        select: { id: true },
      });
      const userIds = tenantUsers.map((u) => u.id);
      referrerFilter.referrerId = { in: userIds };
    }

    const [totalReferrals, conversions, pendingSignups, signedUp] = await Promise.all([
      this.prisma.referral.count({ where: referrerFilter }),
      this.prisma.referral.count({ where: { ...referrerFilter, status: 'CONVERTED' } }),
      this.prisma.referral.count({ where: { ...referrerFilter, status: 'PENDING' } }),
      this.prisma.referral.count({ where: { ...referrerFilter, status: 'SIGNED_UP' } }),
    ]);

    const totalInvitations = await this.prisma.referralInvitation.count({
      where: tenantId
        ? {
            senderUserId: {
              in: (await this.prisma.user.findMany({ where: { tenantId }, select: { id: true } }))
                .map((u) => u.id),
            },
            ...(Object.keys(dateFilter).length > 0 ? { sentAt: dateFilter } : {}),
          }
        : Object.keys(dateFilter).length > 0
          ? { sentAt: dateFilter }
          : {},
    });

    const activeRewards = await this.prisma.referralReward.count({
      where: { status: 'ACTIVE', expiresAt: { gt: new Date() } },
    });

    return {
      totalReferrals,
      conversions,
      pendingSignups,
      signedUp,
      conversionRate: totalReferrals > 0 ? Math.round((conversions / totalReferrals) * 100) : 0,
      totalInvitations,
      activeRewards,
    };
  }

  async getTopReferrers(limit = 20, tenantId?: string) {
    const where: Record<string, unknown> = {};
    if (tenantId) {
      const tenantUsers = await this.prisma.user.findMany({
        where: { tenantId },
        select: { id: true },
      });
      where.referrerId = { in: tenantUsers.map((u) => u.id) };
    }

    const referrals = await this.prisma.referral.groupBy({
      by: ['referrerId'],
      _count: { id: true },
      where,
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });

    const userIds = referrals.map((r) => r.referrerId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, planId: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    const results = [];
    for (const r of referrals) {
      const user = userMap.get(r.referrerId);
      const conversions = await this.prisma.referral.count({
        where: { referrerId: r.referrerId, status: 'CONVERTED' },
      });
      results.push({
        userId: r.referrerId,
        name: user?.name ?? 'Unknown',
        email: user?.email ?? '',
        plan: user?.planId ?? 'EXPLORER',
        totalReferrals: r._count.id,
        conversions,
        conversionRate: r._count.id > 0 ? Math.round((conversions / r._count.id) * 100) : 0,
      });
    }

    return results;
  }

  async getTrends(groupBy: 'day' | 'week' | 'month' = 'day', from?: Date, to?: Date) {
    const startDate = from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = to ?? new Date();

    const referrals = await this.prisma.referral.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
      select: { createdAt: true, status: true },
      orderBy: { createdAt: 'asc' },
    });

    const buckets = new Map<string, { referrals: number; conversions: number; signups: number }>();

    for (const r of referrals) {
      const key = this.bucketKey(r.createdAt, groupBy);
      const bucket = buckets.get(key) ?? { referrals: 0, conversions: 0, signups: 0 };
      bucket.referrals++;
      if (r.status === 'CONVERTED') bucket.conversions++;
      if (r.status === 'SIGNED_UP' || r.status === 'CONVERTED') bucket.signups++;
      buckets.set(key, bucket);
    }

    return Array.from(buckets.entries()).map(([date, data]) => ({ date, ...data }));
  }

  private bucketKey(date: Date, groupBy: 'day' | 'week' | 'month'): string {
    const d = new Date(date);
    switch (groupBy) {
      case 'month':
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      case 'week': {
        const startOfWeek = new Date(d);
        startOfWeek.setDate(d.getDate() - d.getDay());
        return startOfWeek.toISOString().split('T')[0];
      }
      case 'day':
      default:
        return d.toISOString().split('T')[0];
    }
  }

  async getChannelBreakdown(from?: Date, to?: Date) {
    const dateFilter: Record<string, unknown> = {};
    if (from) dateFilter.gte = from;
    if (to) dateFilter.lte = to;
    const where = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

    const channels = await this.prisma.referral.groupBy({
      by: ['channel'],
      _count: { id: true },
      where,
    });

    const result = [];
    for (const ch of channels) {
      const conversions = await this.prisma.referral.count({
        where: { ...where, channel: ch.channel, status: 'CONVERTED' },
      });
      result.push({
        channel: ch.channel ?? 'unknown',
        total: ch._count.id,
        conversions,
        conversionRate: ch._count.id > 0 ? Math.round((conversions / ch._count.id) * 100) : 0,
      });
    }

    return result;
  }

  async getRewardsSummary() {
    const [active, expired, revoked, totalDaysGranted] = await Promise.all([
      this.prisma.referralReward.count({ where: { status: 'ACTIVE' } }),
      this.prisma.referralReward.count({ where: { status: 'EXPIRED' } }),
      this.prisma.referralReward.count({ where: { status: 'REVOKED' } }),
      this.prisma.referralReward.aggregate({ _sum: { durationDays: true } }),
    ]);

    const byPlan = await this.prisma.referralReward.groupBy({
      by: ['grantedPlan'],
      _count: { id: true },
    });

    return {
      active,
      expired,
      revoked,
      totalDaysGranted: totalDaysGranted._sum.durationDays ?? 0,
      byPlan: byPlan.map((p) => ({ plan: p.grantedPlan, count: p._count.id })),
    };
  }

  async getActiveRewards(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [rewards, total] = await Promise.all([
      this.prisma.referralReward.findMany({
        where: { status: 'ACTIVE', expiresAt: { gt: new Date() } },
        orderBy: { expiresAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.referralReward.count({
        where: { status: 'ACTIVE', expiresAt: { gt: new Date() } },
      }),
    ]);

    const userIds = [...new Set(rewards.map((r) => r.userId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return {
      rewards: rewards.map((r) => ({
        ...r,
        user: userMap.get(r.userId) ?? null,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
}
