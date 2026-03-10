import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Gamification Service — Points, badges, streaks
 * omnilearn.space | Phase 3 | Afflatus Consulting Group
 */

@Injectable()
export class GamificationService {
  constructor(private readonly prisma: PrismaService) {}

  /** Add points for user */
  async addPoints(userId: string, points: number) {
    try {
      const prisma = this.prisma as unknown as { userPoints: { upsert: (args: unknown) => Promise<{ points: number }> } };
      const result = await prisma.userPoints.upsert({
        where: { userId },
        create: { userId, points },
        update: { points: { increment: points } },
      });
      await this.updateStreak(userId);
      return result;
    } catch {
      return { points };
    }
  }

  /** Get user points */
  async getPoints(userId: string) {
    try {
      const prisma = this.prisma as unknown as { userPoints: { findUnique: (args: unknown) => Promise<{ points: number } | null> } };
      const row = await prisma.userPoints.findUnique({ where: { userId } });
      return { points: row?.points ?? 0 };
    } catch {
      return { points: 0 };
    }
  }

  private async updateStreak(userId: string) {
    try {
      const prisma = this.prisma as unknown as { userStreak: { upsert: (args: unknown) => Promise<unknown> } };
      await prisma.userStreak.upsert({
        where: { userId },
        create: { userId, currentStreak: 1, longestStreak: 1, lastActivityAt: new Date() },
        update: { lastActivityAt: new Date() },
      });
    } catch {
      // ignore
    }
  }

  /** Get user streak */
  async getStreak(userId: string) {
    try {
      const prisma = this.prisma as unknown as { userStreak: { findUnique: (args: unknown) => Promise<{ currentStreak: number; longestStreak: number } | null> } };
      const row = await prisma.userStreak.findUnique({ where: { userId } });
      return { currentStreak: row?.currentStreak ?? 0, longestStreak: row?.longestStreak ?? 0 };
    } catch {
      return { currentStreak: 0, longestStreak: 0 };
    }
  }

  /** Award badge to user */
  async awardBadge(userId: string, badgeSlug: string) {
    const prisma = this.prisma as unknown as { badge: { findUnique: (args: unknown) => Promise<{ id: string } | null> }; userBadge: { create: (args: unknown) => Promise<unknown> } };
    const badge = await prisma.badge.findUnique({ where: { slug: badgeSlug } });
    if (!badge) throw new Error('Badge not found');
    return prisma.userBadge.create({ data: { userId, badgeId: badge.id } });
  }

  /** Get user badges */
  async getUserBadges(userId: string) {
    try {
      const prisma = this.prisma as unknown as { userBadge: { findMany: (args: unknown) => Promise<unknown[]> } };
      return prisma.userBadge.findMany({ where: { userId }, include: { badge: true } });
    } catch {
      return [];
    }
  }

  /** Get leaderboard */
  async getLeaderboard(limit = 10) {
    try {
      const prisma = this.prisma as unknown as { userPoints: { findMany: (args: unknown) => Promise<{ userId: string; points: number }[]> } };
      return prisma.userPoints.findMany({ orderBy: { points: 'desc' }, take: limit });
    } catch {
      return [];
    }
  }
}
