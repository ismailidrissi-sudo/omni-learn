import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  POINT_REASONS,
  POINT_VALUES,
  PointReason,
} from './gamification.rules';

export interface GrantPointsInput {
  userId: string;
  tenantId: string;
  reason: PointReason;
  sourceType?: string;
  sourceId?: string;
  idempotencyKey: string;
  overrideDelta?: number; // only for ADMIN_GRANT / ADMIN_REVOKE
}

export interface GrantPointsResult {
  ok: true;
  points: number;
  delta: number;
  idempotent: boolean;
}

@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async grantPoints(input: GrantPointsInput): Promise<GrantPointsResult> {
    const delta = this.resolveDelta(input);
    if (delta === 0 && input.reason !== POINT_REASONS.ADMIN_GRANT) {
      throw new BadRequestException(`Reason ${input.reason} resolves to 0 points`);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.pointsLedger.create({
          data: {
            userId: input.userId,
            tenantId: input.tenantId,
            delta,
            reason: input.reason,
            sourceType: input.sourceType,
            sourceId: input.sourceId,
            idempotencyKey: input.idempotencyKey,
          },
        });

        const row = await tx.userPoints.upsert({
          where: { userId: input.userId },
          create: {
            userId: input.userId,
            tenantId: input.tenantId,
            points: delta,
          },
          update: { points: { increment: delta } },
        });

        await this.updateStreakTx(tx, input.userId);

        return {
          ok: true as const,
          points: row.points,
          delta,
          idempotent: false,
        };
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const current = await this.prisma.userPoints.findUnique({
          where: { userId: input.userId },
        });
        return {
          ok: true as const,
          points: current?.points ?? 0,
          delta: 0,
          idempotent: true,
        };
      }
      this.logger.error(
        `grantPoints failed user=${input.userId} reason=${input.reason}`,
        err as Error,
      );
      throw err;
    }
  }

  async getPoints(userId: string): Promise<number> {
    const row = await this.prisma.userPoints.findUnique({ where: { userId } });
    return row?.points ?? 0;
  }

  private resolveDelta(input: GrantPointsInput): number {
    if (
      input.reason === POINT_REASONS.ADMIN_GRANT ||
      input.reason === POINT_REASONS.ADMIN_REVOKE
    ) {
      if (
        typeof input.overrideDelta !== 'number' ||
        !Number.isFinite(input.overrideDelta)
      ) {
        throw new BadRequestException('overrideDelta required for admin reasons');
      }
      return Math.trunc(input.overrideDelta);
    }
    return POINT_VALUES[input.reason];
  }

  async tickStreak(userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.updateStreakTx(tx, userId);
    });
  }

  async getStreak(userId: string) {
    const row = await this.prisma.userStreak.findUnique({ where: { userId } });
    return {
      currentStreak: row?.currentStreak ?? 0,
      longestStreak: row?.longestStreak ?? 0,
      lastActivityAt: row?.lastActivityAt ?? null,
    };
  }

  private async updateStreakTx(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<void> {
    const existing = await tx.userStreak.findUnique({ where: { userId } });
    const now = new Date();

    if (!existing) {
      await tx.userStreak.create({
        data: {
          userId,
          currentStreak: 1,
          longestStreak: 1,
          lastActivityAt: now,
        },
      });
      return;
    }

    const tz = existing.timezone || 'UTC';
    const daysSince = this.calendarDaysBetween(
      existing.lastActivityAt,
      now,
      tz,
    );

    let currentStreak = existing.currentStreak;
    let longestStreak = existing.longestStreak;

    if (daysSince === 0) {
      // same calendar day — no counter change
    } else if (daysSince === 1) {
      currentStreak = existing.currentStreak + 1;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 1;
    }

    await tx.userStreak.update({
      where: { userId },
      data: { currentStreak, longestStreak, lastActivityAt: now },
    });
  }

  private calendarDaysBetween(
    from: Date | null,
    to: Date,
    timezone: string,
  ): number {
    if (!from) return Number.POSITIVE_INFINITY;
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const fromDay = new Date(`${fmt.format(from)}T00:00:00Z`);
    const toDay = new Date(`${fmt.format(to)}T00:00:00Z`);
    return Math.round((toDay.getTime() - fromDay.getTime()) / 86_400_000);
  }

  async getBadges(userId: string) {
    return this.prisma.userBadge.findMany({
      where: { userId },
      include: { badge: true },
      orderBy: { earnedAt: 'desc' },
    });
  }

  async awardBadge(userId: string, badgeSlug: string) {
    const badge = await this.prisma.badge.findUnique({
      where: { slug: badgeSlug },
    });
    if (!badge) {
      throw new NotFoundException(`Badge not found: ${badgeSlug}`);
    }
    try {
      return await this.prisma.userBadge.create({
        data: { userId, badgeId: badge.id },
        include: { badge: true },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const existing = await this.prisma.userBadge.findUnique({
          where: { userId_badgeId: { userId, badgeId: badge.id } },
          include: { badge: true },
        });
        if (existing) return existing;
        throw new ConflictException('Badge already awarded');
      }
      throw err;
    }
  }

  async getLeaderboard(tenantId: string, limit = 10) {
    const safeLimit = Math.min(Math.max(1, Math.trunc(limit)), 100);
    return this.prisma.userPoints.findMany({
      where: { tenantId },
      orderBy: { points: 'desc' },
      take: safeLimit,
      select: {
        userId: true,
        points: true,
        user: { select: { id: true, name: true } },
      },
    });
  }
}
