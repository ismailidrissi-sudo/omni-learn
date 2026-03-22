import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IntelligenceService } from '../intelligence/intelligence.service';

/**
 * Microlearning Service — TikTok/Reels-style feed, likes, comments, share
 * omnilearn.space | Afflatus Consulting Group
 */

@Injectable()
export class MicrolearningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly intelligence: IntelligenceService,
  ) {}

  /** Get all content assigned to a user (from enrollments + MICRO_LEARNING) */
  async getAssignedContent(userId: string) {
    const enrollments = await this.prisma.pathEnrollment.findMany({
      where: { userId, status: 'ACTIVE' },
      include: {
        path: {
          include: {
            steps: {
              orderBy: { stepOrder: 'asc' },
              include: { contentItem: true },
            },
          },
        },
      },
    });

    const contentFromPaths = enrollments.flatMap((e) =>
      e.path.steps.map((s) => ({ ...s.contentItem, source: 'path' as const, pathName: e.path.name })),
    );

    const pathContentIds = new Set(contentFromPaths.map((c) => c.id));

    const allMicrolearnings = await this.prisma.contentItem.findMany({
      where: { type: 'MICRO_LEARNING' },
      orderBy: { createdAt: 'desc' },
    });

    const microFromPaths = contentFromPaths.filter((c) => c.type === 'MICRO_LEARNING');
    const microNotInPaths = allMicrolearnings.filter((c) => !pathContentIds.has(c.id));
    const allMicro = [...microFromPaths, ...microNotInPaths];
    const microIds = allMicro.map((c) => c.id);

    let likeCounts: { contentId: string; _count: { contentId: number } }[] = [];
    let commentCounts: { contentId: string; _count: { contentId: number } }[] = [];
    let userLikes: { contentId: string }[] = [];

    if (microIds.length > 0) {
      [likeCounts, commentCounts, userLikes] = await Promise.all([
        this.prisma.microLearningLike.groupBy({
          by: ['contentId'],
          where: { contentId: { in: microIds } },
          _count: { contentId: true },
        }),
        this.prisma.microLearningComment.groupBy({
          by: ['contentId'],
          where: { contentId: { in: microIds } },
          _count: { contentId: true },
        }),
        this.prisma.microLearningLike.findMany({
          where: { contentId: { in: microIds }, userId },
          select: { contentId: true },
        }),
      ]);
    }

    const likeMap = new Map(likeCounts.map((l) => [l.contentId, l._count.contentId]));
    const commentMap = new Map(commentCounts.map((c) => [c.contentId, c._count.contentId]));
    const likedSet = new Set(userLikes.map((l) => l.contentId));

    return {
      paths: enrollments.map((e) => ({
        id: e.path.id,
        name: e.path.name,
        steps: e.path.steps.map((s) => s.contentItem),
      })),
      microlearnings: allMicro.map((c) => ({
        ...c,
        likeCount: likeMap.get(c.id) ?? 0,
        commentCount: commentMap.get(c.id) ?? 0,
        likedByMe: likedSet.has(c.id),
      })),
    };
  }

  /** Get microlearning feed for user — ML-ranked; optional seed puts that clip first for deep links */
  async getFeed(userId: string, limit = 20, offset = 0, seedContentId?: string) {
    const orderedIds = await this.intelligence.getMicrolearningFeedOrder(
      userId,
      seedContentId,
      limit + offset,
    );
    const slice = orderedIds.slice(offset, offset + limit);
    if (slice.length === 0) return [];

    const rows = await this.prisma.contentItem.findMany({
      where: { id: { in: slice } },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    const items = slice.map((id) => byId.get(id)).filter((c): c is NonNullable<typeof c> => c != null);

    const contentIds = items.map((c) => c.id);

    const [likeCounts, commentCounts, userLikes] = await Promise.all([
      this.prisma.microLearningLike.groupBy({
        by: ['contentId'],
        where: { contentId: { in: contentIds } },
        _count: { contentId: true },
      }),
      this.prisma.microLearningComment.groupBy({
        by: ['contentId'],
        where: { contentId: { in: contentIds } },
        _count: { contentId: true },
      }),
      this.prisma.microLearningLike.findMany({
        where: { contentId: { in: contentIds }, userId },
      }),
    ]);

    const likeMap = new Map(likeCounts.map((l) => [l.contentId, l._count.contentId]));
    const commentMap = new Map(commentCounts.map((c) => [c.contentId, c._count.contentId]));
    const likedSet = new Set(userLikes.map((l) => l.contentId));

    return items.map((item) => ({
      ...item,
      likeCount: likeMap.get(item.id) ?? 0,
      commentCount: commentMap.get(item.id) ?? 0,
      likedByMe: likedSet.has(item.id),
    }));
  }

  /** Toggle like on a microlearning video */
  async toggleLike(contentId: string, userId: string) {
    const existing = await this.prisma.microLearningLike.findUnique({
      where: {
        contentId_userId: { contentId, userId },
      },
    });

    if (existing) {
      await this.prisma.microLearningLike.delete({
        where: { id: existing.id },
      });
      return { liked: false };
    }

    await this.prisma.microLearningLike.create({
      data: { contentId, userId },
    });
    return { liked: true };
  }

  /** Add comment */
  async addComment(contentId: string, userId: string, body: string) {
    const comment = await this.prisma.microLearningComment.create({
      data: { contentId, userId, body },
    });
    return comment;
  }

  /** Get comments for content */
  async getComments(contentId: string, limit = 50) {
    const comments = await this.prisma.microLearningComment.findMany({
      where: { contentId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return comments;
  }

  /** Record share (analytics) */
  async recordShare(contentId: string, userId: string) {
    await this.prisma.analyticsEvent.create({
      data: {
        eventType: 'MICROLEARNING_SHARE',
        userId,
        contentId,
        payload: '{}',
      },
    });
    return { shared: true };
  }
}
