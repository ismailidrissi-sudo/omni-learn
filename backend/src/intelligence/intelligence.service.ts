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

  /** AI content recommendations for a user — tries LightFM first, falls back to embedding-based */
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
          const data = (await res.json()) as { recommendations?: Array<{ contentId: string; score: number }> };
          const ids = (data.recommendations || []).map((r) => r.contentId);
          if (ids.length > 0) {
            const items = await this.prisma.contentItem.findMany({
              where: { id: { in: ids } },
              include: { pathSteps: { include: { path: true } } },
            });
            const order = new Map(ids.map((id, i) => [id, i]));
            const scored = items
              .sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99))
              .map((item) => {
                const rec = data.recommendations?.find((r) => r.contentId === item.id);
                return { ...item, score: rec?.score ?? 0 };
              });
            return scored;
          }
        }
      } catch {
        // Fall through to embedding-based
      }
    }

    const searchText = query ?? '';
    const embedding = await this.embedding.embed(searchText || 'learning course');

    const items = await this.prisma.contentItem.findMany({
      where: { id: { notIn: excludeIds } },
      include: { pathSteps: { include: { path: true } } },
    });

    const scored = items
      .map((item) => {
        const emb = parseEmbedding((item as { embeddingJson?: string | null }).embeddingJson ?? null);
        const sim = emb ? cosineSimilarity(embedding, emb) : 0.5;
        const titleMatch = searchText
          ? (item.title.toLowerCase().includes(searchText.toLowerCase()) ? 0.3 : 0)
          : 0;
        return { item, score: sim + titleMatch };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored.map((s) => ({ ...s.item, score: s.score }));
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

  /** Smart path suggestions for a user */
  async getPathSuggestions(userId: string, limit = 5) {
    const enrollments = await this.prisma.pathEnrollment.findMany({
      where: { userId },
      include: { path: { include: { steps: true } } },
    });

    const completedDomains = new Set(
      enrollments
        .filter((e) => e.status === 'COMPLETED')
        .map((e) => e.path.domainId),
    );

    const allPaths = await this.prisma.learningPath.findMany({
      where: { isPublished: true },
      include: { steps: true, domain: true, _count: { select: { enrollments: true } } },
    });

    const enrolledIds = new Set(enrollments.map((e) => e.pathId));
    const candidates = allPaths.filter((p) => !enrolledIds.has(p.id));

    const scored = candidates.map((path) => {
      let score = 0;
      if (completedDomains.has(path.domainId)) score += 0.5;
      score += Math.min(path._count.enrollments * 0.01, 0.3);
      score += Math.random() * 0.2;
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
