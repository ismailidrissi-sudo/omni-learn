import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface SuggestionItem {
  contentId: string;
  title: string;
  description: string;
  thumbnailUrl?: string;
  categoryBadge?: string;
  duration?: string;
}

/**
 * Retrieves content suggestions for a user based on the given strategy.
 * Strategies: post_signup (top-rated), trending (popular this week),
 *             curated (domain-matched), reengagement (newest).
 */
@Injectable()
export class SuggestionEngineService {
  private readonly logger = new Logger(SuggestionEngineService.name);
  private readonly db: any;

  constructor(private readonly prisma: PrismaService) {
    this.db = prisma as any;
  }

  async getSuggestions(
    userId: string,
    strategyLabel: string,
    limit: number,
  ): Promise<SuggestionItem[]> {
    switch (strategyLabel) {
      case 'post_signup':
        return this.topRated(limit);
      case 'trending':
        return this.trending(limit);
      case 'curated':
        return this.curatedForUser(userId, limit);
      case 'reengagement':
        return this.newest(limit);
      default:
        return this.topRated(limit);
    }
  }

  private async topRated(limit: number): Promise<SuggestionItem[]> {
    const items = await this.prisma.contentItem.findMany({
      where: { accessLevel: 0 },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { domain: { select: { name: true } } },
    });
    return items.map((i) => this.toSuggestion(i));
  }

  private async trending(limit: number): Promise<SuggestionItem[]> {
    const weekAgo = new Date(Date.now() - 7 * 24 * 3_600_000);
    const popular = await this.db.userContentInteraction.groupBy({
      by: ['contentId'],
      where: { lastInteractionAt: { gte: weekAgo } },
      _count: { contentId: true },
      orderBy: { _count: { contentId: 'desc' } },
      take: limit,
    });

    if (popular.length === 0) return this.topRated(limit);

    const ids = popular.map((p: { contentId: string }) => p.contentId);
    const items = await this.prisma.contentItem.findMany({
      where: { id: { in: ids } },
      include: { domain: { select: { name: true } } },
    });

    const order = new Map<string, number>(ids.map((id: string, idx: number) => [id, idx]));
    items.sort(
      (a, b) => (order.get(a.id as string) ?? 0) - (order.get(b.id as string) ?? 0),
    );
    return items.map((i) => this.toSuggestion(i));
  }

  private async curatedForUser(userId: string, limit: number): Promise<SuggestionItem[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { sectorFocus: true },
    });

    const where = user?.sectorFocus
      ? { sectorTag: user.sectorFocus, accessLevel: { lte: 1 } }
      : { accessLevel: 0 };

    const items = await this.prisma.contentItem.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { domain: { select: { name: true } } },
    });

    if (items.length === 0) return this.topRated(limit);
    return items.map((i) => this.toSuggestion(i));
  }

  private async newest(limit: number): Promise<SuggestionItem[]> {
    const items = await this.prisma.contentItem.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { domain: { select: { name: true } } },
    });
    return items.map((i) => this.toSuggestion(i));
  }

  private toSuggestion(item: any): SuggestionItem {
    const minutes = item.durationMinutes;
    const duration = minutes ? `${minutes} min` : undefined;

    return {
      contentId: item.id,
      title: item.title,
      description: item.description || '',
      categoryBadge: item.domain?.name,
      duration,
    };
  }
}
