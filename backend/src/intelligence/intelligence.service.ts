import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingService } from './embedding.service';

/**
 * Intelligence Service — AI recommendations, semantic search, path suggestions, predictive analytics
 * omnilearn.space | Afflatus Consulting Group
 */

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom ? dot / denom : 0;
}

function parseEmbedding(s: string | null | undefined): number[] | null {
  if (s == null || s === '') return null;
  try {
    const arr = JSON.parse(s);
    return Array.isArray(arr) ? arr : null;
  } catch {
    return null;
  }
}

@Injectable()
export class IntelligenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embedding: EmbeddingService,
  ) {}

  /** Build a personalized query string from user profile and learning history */
  private async buildUserProfileQuery(userId: string): Promise<string> {
    const parts: string[] = [];

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        department: true,
        position: true,
        tenant: { include: { industry: true } },
      },
    });

    if (user) {
      if (user.department?.name) parts.push(user.department.name);
      if (user.position?.name) parts.push(user.position.name);
      if (user.tenant?.industry?.name) parts.push(user.tenant.industry.name);
      if (user.sectorFocus) parts.push(user.sectorFocus);
    }

    const enrollments = await this.prisma.pathEnrollment.findMany({
      where: { userId },
      include: { path: { include: { domain: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });

    const domainNames = new Set<string>();
    for (const e of enrollments) {
      if (e.path.domain?.name) domainNames.add(e.path.domain.name);
      parts.push(e.path.name);
    }
    for (const d of domainNames) parts.push(d);

    const recentEvents = await this.prisma.analyticsEvent.findMany({
      where: { userId, contentId: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { contentId: true },
    });
    if (recentEvents.length > 0) {
      const recentContent = await this.prisma.contentItem.findMany({
        where: { id: { in: recentEvents.map((e) => e.contentId!).filter(Boolean) } },
        select: { title: true },
      });
      for (const c of recentContent) parts.push(c.title);
    }

    return parts.length > 0 ? parts.join(' ') : 'learning course training';
  }

  /** AI content recommendations for a user — tries LightFM first, falls back to personalized embeddings */
  async getContentRecommendations(
    userId: string,
    query?: string,
    limit = 10,
    excludeIds: string[] = [],
  ) {
    const lightfmUrl = process.env.LIGHTFM_SERVICE_URL;
    if (lightfmUrl) {
      try {
        const url = `${lightfmUrl}/recommend/${encodeURIComponent(userId)}?limit=${limit}&exclude=${excludeIds.join(',')}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = (await res.json()) as {
            recommendations?: Array<{ contentId: string; score: number }>;
            source?: string;
          };
          const ids = (data.recommendations || []).map((r) => r.contentId);
          if (ids.length > 0) {
            const items = await this.prisma.contentItem.findMany({
              where: { id: { in: ids } },
              include: { pathSteps: { include: { path: true } }, domain: true },
            });
            const order = new Map(ids.map((id, i) => [id, i]));
            return items
              .sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99))
              .map((item) => {
                const rec = data.recommendations?.find((r) => r.contentId === item.id);
                return { ...item, score: rec?.score ?? 0, source: data.source ?? 'lightfm' };
              });
          }
        }
      } catch {
        // Fall through to embedding-based
      }
    }

    const searchText = query || (userId !== 'anonymous' ? await this.buildUserProfileQuery(userId) : '');
    const embeddingVec = await this.embedding.embed(searchText || 'learning course training');

    const enrolledContentIds = new Set<string>();
    if (userId !== 'anonymous') {
      const enrollments = await this.prisma.pathEnrollment.findMany({
        where: { userId },
        include: { path: { include: { steps: true } } },
      });
      for (const e of enrollments) {
        for (const step of e.path.steps) {
          enrolledContentIds.add(step.contentItemId);
        }
      }
    }

    const items = await this.prisma.contentItem.findMany({
      where: { id: { notIn: [...excludeIds, ...enrolledContentIds] } },
      include: { pathSteps: { include: { path: true } }, domain: true },
    });

    const scored = items
      .map((item) => {
        const emb = parseEmbedding((item as { embeddingJson?: string | null }).embeddingJson ?? null);
        const sim = emb ? cosineSimilarity(embeddingVec, emb) : 0.5;
        const titleMatch = searchText
          ? searchText.toLowerCase().split(/\s+/).reduce(
              (s, w) => s + (item.title.toLowerCase().includes(w) ? 0.1 : 0),
              0,
            )
          : 0;
        return { item, score: Math.min(sim + titleMatch, 1) };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored.map((s) => ({ ...s.item, score: s.score, source: 'embedding' }));
  }

  /** Semantic search over content */
  async semanticSearch(query: string, limit = 20) {
    const embedding = await this.embedding.embed(query);
    const items = await this.prisma.contentItem.findMany({
      include: { pathSteps: { include: { path: true } } },
    });

    const scored = items
      .map((item) => {
        const emb = parseEmbedding((item as { embeddingJson?: string | null }).embeddingJson ?? null);
        const sim = emb ? cosineSimilarity(embedding, emb) : 0;
        const kw = query.toLowerCase().split(/\s+/).filter(Boolean);
        const titleScore = kw.reduce(
          (s, w) => s + (item.title.toLowerCase().includes(w) ? 1 : 0),
          0,
        );
        return { item, score: sim * 0.7 + Math.min(titleScore * 0.2, 0.3) };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored.map((s) => ({ ...s.item, relevance: s.score }));
  }

  /**
   * Order MICRO_LEARNING ids for a vertical feed: optional seed first, then ML-ranked
   * (LightFM when configured, else embedding + profile similarity via getContentRecommendations).
   */
  async getMicrolearningFeedOrder(
    userId: string,
    seedContentId: string | undefined,
    limit: number,
  ): Promise<string[]> {
    const microItems = await this.prisma.contentItem.findMany({
      where: { type: 'MICRO_LEARNING' },
      select: { id: true, title: true, description: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    if (microItems.length === 0) return [];

    const microIds = new Set(microItems.map((m) => m.id));
    let seedQuery = '';
    if (seedContentId) {
      const seed = microItems.find((m) => m.id === seedContentId);
      if (seed) {
        seedQuery = `${seed.title} ${seed.description ?? ''}`.trim();
      }
    }

    const recs = await this.getContentRecommendations(
      userId,
      seedQuery || undefined,
      Math.max(limit * 4, 40),
      seedContentId && microIds.has(seedContentId) ? [seedContentId] : [],
    );

    const ordered: string[] = [];
    const seen = new Set<string>();

    if (seedContentId && microIds.has(seedContentId)) {
      ordered.push(seedContentId);
      seen.add(seedContentId);
    }

    for (const r of recs) {
      if ((r as { type?: string }).type !== 'MICRO_LEARNING') continue;
      if (seen.has(r.id)) continue;
      ordered.push(r.id);
      seen.add(r.id);
      if (ordered.length >= limit) break;
    }

    for (const m of microItems) {
      if (ordered.length >= limit) break;
      if (!seen.has(m.id)) {
        ordered.push(m.id);
        seen.add(m.id);
      }
    }

    return ordered.slice(0, limit);
  }

  /** Trending content based on real engagement signals */
  async getTrendingContent(limit = 10) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [recentEvents, recentLikes, recentReviews] = await Promise.all([
      this.prisma.analyticsEvent.groupBy({
        by: ['contentId'],
        where: { contentId: { not: null }, createdAt: { gte: since } },
        _count: { contentId: true },
        orderBy: { _count: { contentId: 'desc' } },
        take: limit * 3,
      }),
      this.prisma.microLearningLike.groupBy({
        by: ['contentId'],
        where: { createdAt: { gte: since } },
        _count: { contentId: true },
        orderBy: { _count: { contentId: 'desc' } },
        take: limit * 3,
      }),
      this.prisma.courseReview.groupBy({
        by: ['contentId'],
        where: { createdAt: { gte: since } },
        _avg: { rating: true },
        _count: { contentId: true },
        orderBy: { _count: { contentId: 'desc' } },
        take: limit * 3,
      }),
    ]);

    const trendScores = new Map<string, number>();
    for (const e of recentEvents) {
      if (e.contentId) trendScores.set(e.contentId, (trendScores.get(e.contentId) ?? 0) + e._count.contentId * 1);
    }
    for (const l of recentLikes) {
      trendScores.set(l.contentId, (trendScores.get(l.contentId) ?? 0) + l._count.contentId * 2);
    }
    for (const r of recentReviews) {
      const ratingBoost = (r._avg.rating ?? 3) / 5;
      trendScores.set(r.contentId, (trendScores.get(r.contentId) ?? 0) + r._count.contentId * 3 * ratingBoost);
    }

    const sorted = [...trendScores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
    const topIds = sorted.map(([id]) => id);

    if (topIds.length === 0) {
      return this.prisma.contentItem.findMany({
        take: limit,
        include: { domain: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    const items = await this.prisma.contentItem.findMany({
      where: { id: { in: topIds } },
      include: { domain: true },
    });

    const order = new Map(topIds.map((id, i) => [id, i]));
    return items
      .sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99))
      .map((item) => ({
        ...item,
        trendScore: trendScores.get(item.id) ?? 0,
      }));
  }

  /** Smart path suggestions using user profile, history, and popularity */
  async getPathSuggestions(userId: string, limit = 5) {
    const enrollments = await this.prisma.pathEnrollment.findMany({
      where: { userId },
      include: { path: { include: { steps: true, domain: true } } },
    });

    const completedDomains = new Set(
      enrollments
        .filter((e) => e.status === 'COMPLETED')
        .map((e) => e.path.domainId),
    );
    const activeDomains = new Set(
      enrollments
        .filter((e) => e.status === 'ACTIVE')
        .map((e) => e.path.domainId),
    );

    let userIndustryCode: string | null = null;
    let userSector: string | null = null;
    if (userId !== 'anonymous') {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { tenant: { include: { industry: true } } },
      });
      userIndustryCode = user?.tenant?.industry?.code ?? null;
      userSector = user?.sectorFocus ?? null;
    }

    const allPaths = await this.prisma.learningPath.findMany({
      where: { isPublished: true },
      include: {
        steps: { include: { contentItem: { select: { sectorTag: true } } } },
        domain: true,
        _count: { select: { enrollments: true } },
      },
    });

    const enrolledIds = new Set(enrollments.map((e) => e.pathId));
    const candidates = allPaths.filter((p) => !enrolledIds.has(p.id));

    const scored = candidates.map((path) => {
      let score = 0;

      if (completedDomains.has(path.domainId)) score += 0.4;
      if (activeDomains.has(path.domainId)) score += 0.2;

      const pathSectors = path.steps
        .map((s) => s.contentItem.sectorTag)
        .filter(Boolean);
      if (userSector && pathSectors.some((s) => s === userSector)) score += 0.3;
      if (userIndustryCode && pathSectors.some((s) => s?.toLowerCase().includes(userIndustryCode!.toLowerCase()))) score += 0.2;

      const popularity = Math.min(path._count.enrollments * 0.02, 0.3);
      score += popularity;

      if (path.difficulty === 'beginner' && enrollments.length === 0) score += 0.15;
      if (path.difficulty === 'advanced' && completedDomains.size > 2) score += 0.15;

      return { path, score };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.path);
  }

  /** Predictive analytics: completion likelihood, at-risk enrollments */
  async getPredictiveAnalytics(tenantId?: string) {
    const enrollments = await this.prisma.pathEnrollment.findMany({
      where: {
        status: 'ACTIVE',
        ...(tenantId ? { path: { tenantId } } : {}),
      },
      include: {
        path: true,
        stepProgress: true,
      },
    });

    const atRisk: Array<{
      enrollmentId: string;
      userId: string;
      pathName: string;
      progressPct: number;
      riskScore: number;
      reason: string;
    }> = [];

    const now = new Date();
    for (const e of enrollments) {
      let riskScore = 0;
      let reason = '';

      if (e.progressPct < 20 && e.deadline && e.deadline < new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)) {
        riskScore += 0.6;
        reason = 'Low progress, deadline soon';
      }
      if (e.progressPct < 10) {
        riskScore += 0.3;
        reason = reason || 'Very low progress';
      }
      if (e.stepProgress.length === 0) {
        riskScore += 0.2;
        reason = reason || 'No activity yet';
      }

      if (riskScore > 0.3) {
        atRisk.push({
          enrollmentId: e.id,
          userId: e.userId,
          pathName: e.path.name,
          progressPct: e.progressPct,
          riskScore,
          reason,
        });
      }
    }

    const completed = await this.prisma.pathEnrollment.count({
      where: { status: 'COMPLETED', ...(tenantId ? { path: { tenantId } } : {}) },
    });
    const total = enrollments.length + completed;
    const completionRate = total > 0 ? completed / total : 0;

    return {
      atRiskEnrollments: atRisk.sort((a, b) => b.riskScore - a.riskScore).slice(0, 20),
      predictedCompletionRate: Math.round(completionRate * 100),
      totalActive: enrollments.length,
    };
  }

  /** Export interactions and user/item features for LightFM training */
  async getLightFmInteractions() {
    const [events, enrollments, stepProgress, reviews, likes] = await Promise.all([
      this.prisma.analyticsEvent.findMany({
        where: { userId: { not: null }, contentId: { not: null } },
        select: { userId: true, contentId: true, eventType: true },
      }),
      this.prisma.pathEnrollment.findMany({
        where: { status: { in: ['ACTIVE', 'COMPLETED'] } },
        select: { userId: true, pathId: true },
      }),
      this.prisma.pathStepProgress.findMany({
        where: { status: 'COMPLETED' },
        select: { enrollment: { select: { userId: true } }, step: { select: { contentItemId: true } } },
      }),
      this.prisma.courseReview.findMany({ select: { userId: true, contentId: true, rating: true } }),
      this.prisma.microLearningLike.findMany({ select: { userId: true, contentId: true } }),
    ]);

    const interactions: Array<[string, string, number]> = [];
    const seen = new Set<string>();

    for (const e of events) {
      if (e.userId && e.contentId) {
        const key = `${e.userId}:${e.contentId}`;
        if (!seen.has(key)) {
          seen.add(key);
          const w = e.eventType === 'COMPLETION' ? 3 : e.eventType === 'ENROLLMENT' ? 2 : 1;
          interactions.push([e.userId, e.contentId, w]);
        }
      }
    }
    for (const p of stepProgress) {
      const userId = p.enrollment?.userId;
      const contentId = p.step?.contentItemId;
      if (userId && contentId) {
        const key = `${userId}:${contentId}`;
        if (!seen.has(key)) {
          seen.add(key);
          interactions.push([userId, contentId, 3]);
        }
      }
    }
    for (const r of reviews) {
      const key = `${r.userId}:${r.contentId}`;
      if (!seen.has(key)) {
        seen.add(key);
        interactions.push([r.userId, r.contentId, Math.max(1, r.rating)]);
      }
    }
    for (const l of likes) {
      const key = `${l.userId}:${l.contentId}`;
      if (!seen.has(key)) {
        seen.add(key);
        interactions.push([l.userId, l.contentId, 2]);
      }
    }

    // Path enrollments -> map to content via path steps
    const pathSteps = await this.prisma.learningPathStep.findMany({
      where: { pathId: { in: enrollments.map((e) => e.pathId) } },
      select: { pathId: true, contentItemId: true },
    });
    const pathToContent = new Map<string, string[]>();
    for (const ps of pathSteps) {
      const list = pathToContent.get(ps.pathId) || [];
      list.push(ps.contentItemId);
      pathToContent.set(ps.pathId, list);
    }
    for (const e of enrollments) {
      const contentIds = pathToContent.get(e.pathId) || [];
      for (const cid of contentIds) {
        const key = `${e.userId}:${cid}`;
        if (!seen.has(key)) {
          seen.add(key);
          interactions.push([e.userId, cid, 2]);
        }
      }
    }

    const userIds = [...new Set(interactions.map((i) => i[0]))];
    const contentIds = [...new Set(interactions.map((i) => i[1]))];

    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      include: { department: true, position: true, tenant: { include: { industry: true } } },
    });
    const items = await this.prisma.contentItem.findMany({
      where: { id: { in: contentIds } },
      select: { id: true, type: true, domainId: true, sectorTag: true },
    });

    const userFeatures: Record<string, Record<string, string>> = {};
    for (const u of users) {
      userFeatures[u.id] = {
        department: u.department?.code ?? '',
        position: u.position?.code ?? '',
        industry: u.tenant?.industry?.code ?? '',
        sectorFocus: u.sectorFocus ?? '',
      };
    }
    const itemFeatures: Record<string, Record<string, string>> = {};
    for (const i of items) {
      itemFeatures[i.id] = {
        type: i.type,
        domainId: i.domainId ?? '',
        sectorTag: i.sectorTag ?? '',
      };
    }

    return {
      interactions: interactions.map(([u, i, w]) => ({ userId: u, contentId: i, weight: w })),
      userFeatures,
      itemFeatures,
    };
  }

  /** Embed all content (batch) */
  async embedAllContent() {
    const items = await this.prisma.contentItem.findMany({ select: { id: true } });
    const results: { id: string; ok: boolean }[] = [];
    for (const item of items) {
      try {
        await this.updateContentEmbedding(item.id);
        results.push({ id: item.id, ok: true });
      } catch {
        results.push({ id: item.id, ok: false });
      }
    }
    return { total: items.length, results };
  }

  /** Update content embedding (call when content is created/updated) */
  async updateContentEmbedding(contentId: string) {
    const item = await this.prisma.contentItem.findUniqueOrThrow({
      where: { id: contentId },
    });
    const text = `${item.title} ${item.type}`;
    const vec = await this.embedding.embed(text);
    await this.prisma.contentItem.update({
      where: { id: contentId },
      data: { embedding: vec } as Record<string, unknown>,
    });
    return { contentId, dims: vec.length };
  }
}
