import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationService } from './gamification.service';
import { POINT_REASONS } from './gamification.rules';

describe('GamificationService', () => {
  describe('grantPoints idempotency', () => {
    it('second call with same idempotencyKey returns idempotent true and leaves points unchanged', async () => {
      let ledgerCreates = 0;
      const mockTx = {
        pointsLedger: {
          create: jest.fn(async () => {
            ledgerCreates += 1;
            if (ledgerCreates > 1) {
              throw new Prisma.PrismaClientKnownRequestError('Unique constraint', {
                code: 'P2002',
                clientVersion: 'test',
                meta: { target: ['idempotencyKey'] },
              });
            }
          }),
        },
        userPoints: {
          upsert: jest.fn().mockResolvedValue({ points: 30 }),
        },
        userStreak: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({}),
          update: jest.fn().mockResolvedValue({}),
        },
      };

      const prisma = {
        $transaction: jest.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
          fn(mockTx),
        ),
        userPoints: {
          findUnique: jest.fn().mockResolvedValue({ points: 30 }),
        },
      } as unknown as PrismaService;

      const service = new GamificationService(prisma);
      const input = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        reason: POINT_REASONS.LESSON_COMPLETE,
        idempotencyKey: 'lesson_complete:user-1:lesson-99',
        sourceType: 'lesson',
        sourceId: 'lesson-99',
      };

      const first = await service.grantPoints(input);
      expect(first.idempotent).toBe(false);
      expect(first.delta).toBe(10);
      expect(first.points).toBe(30);

      const second = await service.grantPoints(input);
      expect(second.idempotent).toBe(true);
      expect(second.delta).toBe(0);
      expect(second.points).toBe(30);
      expect(ledgerCreates).toBe(2);
    });
  });

  describe('streak calendar', () => {
    it('activity day 1, day 2, then day 4 yields currentStreak 1 and longestStreak 2', async () => {
      type StreakRow = {
        userId: string;
        currentStreak: number;
        longestStreak: number;
        lastActivityAt: Date | null;
        timezone: string;
      };
      let streak: StreakRow | null = null;

      const streakOps = {
        findUnique: async ({ where: { userId } }: { where: { userId: string } }) =>
          streak?.userId === userId ? streak : null,
        create: async ({
          data,
        }: {
          data: {
            userId: string;
            currentStreak: number;
            longestStreak: number;
            lastActivityAt: Date;
          };
        }) => {
          streak = {
            userId: data.userId,
            currentStreak: data.currentStreak,
            longestStreak: data.longestStreak,
            lastActivityAt: data.lastActivityAt,
            timezone: 'UTC',
          };
        },
        update: async ({
          where: { userId },
          data,
        }: {
          where: { userId: string };
          data: {
            currentStreak: number;
            longestStreak: number;
            lastActivityAt: Date;
          };
        }) => {
          if (!streak || streak.userId !== userId) return;
          streak.currentStreak = data.currentStreak;
          streak.longestStreak = data.longestStreak;
          streak.lastActivityAt = data.lastActivityAt;
        },
      };

      const prisma = {
        $transaction: jest.fn(
          async (fn: (tx: { userStreak: typeof streakOps }) => Promise<void>) =>
            fn({ userStreak: streakOps }),
        ),
        userStreak: streakOps,
      } as unknown as PrismaService;

      const service = new GamificationService(prisma);

      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-01-01T12:00:00Z'));
      await service.tickStreak('u1');
      jest.setSystemTime(new Date('2026-01-02T12:00:00Z'));
      await service.tickStreak('u1');
      jest.setSystemTime(new Date('2026-01-04T12:00:00Z'));
      await service.tickStreak('u1');
      jest.useRealTimers();

      const s = await service.getStreak('u1');
      expect(s.currentStreak).toBe(1);
      expect(s.longestStreak).toBe(2);
    });
  });
});
