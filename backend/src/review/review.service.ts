import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Review Service — Course reviews + ratings
 * omnilearn.space | Afflatus Consulting Group
 */

@Injectable()
export class ReviewService {
  constructor(private readonly prisma: PrismaService) {}

  async getReviews(contentId: string, limit = 20, offset = 0) {
    const [reviews, total] = await Promise.all([
      this.prisma.courseReview.findMany({
        where: { contentId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.courseReview.count({ where: { contentId } }),
    ]);
    return { reviews, total };
  }

  async getStats(contentId: string) {
    const reviews = await this.prisma.courseReview.findMany({
      where: { contentId },
      select: { rating: true },
    });
    const total = reviews.length;
    const avg = total ? reviews.reduce((s, r) => s + r.rating, 0) / total : 0;
    const distribution = [1, 2, 3, 4, 5].map((r) => ({
      rating: r,
      count: reviews.filter((x) => x.rating === r).length,
    }));
    return { total, average: Math.round(avg * 10) / 10, distribution };
  }

  async createOrUpdate(contentId: string, userId: string, rating: number, review?: string) {
    if (rating < 1 || rating > 5) throw new Error('Rating must be 1-5');
    return this.prisma.courseReview.upsert({
      where: { contentId_userId: { contentId, userId } },
      create: { contentId, userId, rating, review },
      update: { rating, review },
    });
  }

  async markHelpful(contentId: string, userId: string) {
    const r = await this.prisma.courseReview.findUnique({
      where: { contentId_userId: { contentId, userId } },
    });
    if (!r) throw new Error('Review not found');
    return this.prisma.courseReview.update({
      where: { id: r.id },
      data: { helpfulCount: r.helpfulCount + 1 },
    });
  }
}
