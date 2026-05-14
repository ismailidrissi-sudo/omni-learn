import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { CourseEnrollmentService } from '../course-enrollment/course-enrollment.service';
import { GamificationService } from '../gamification/gamification.service';
import { POINT_REASONS } from '../gamification/gamification.rules';
import { firstValueFrom } from 'rxjs';
import { UpdateProgressDto } from './dto/update-progress.dto';

@Injectable()
export class VideoService {
  private readonly logger = new Logger(VideoService.name);
  private readonly proxyUrl: string;
  private readonly internalKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly courseEnrollmentService: CourseEnrollmentService,
    private readonly gamification: GamificationService,
  ) {
    this.proxyUrl = process.env.VIDEO_PROXY_SERVICE_URL || 'http://localhost:5001';
    this.internalKey = process.env.INTERNAL_SERVICE_KEY || '';
  }

  private get headers() {
    const h: Record<string, string> = {};
    if (this.internalKey) h['x-internal-key'] = this.internalKey;
    return h;
  }

  /**
   * Resolve a YouTube URL to a platform-internal stream endpoint.
   * Calls the Python video-proxy microservice.
   */
  async resolveVideo(url: string, preferredQuality?: string) {
    const { data } = await firstValueFrom(
      this.http.post(
        `${this.proxyUrl}/resolve`,
        { url, preferred_quality: preferredQuality },
        { headers: this.headers },
      ),
    );

    return {
      videoId: data.video_id,
      streamEndpoint: `/video/stream/${data.video_id}`,
      duration: data.duration,
      title: data.title,
      thumbnail: data.thumbnail,
      width: data.width,
      height: data.height,
    };
  }

  /**
   * Get the upstream stream URL for proxying bytes to the client.
   */
  async getStreamUrl(videoId: string): Promise<string> {
    const { data } = await firstValueFrom(
      this.http.get(`${this.proxyUrl}/stream-url/${videoId}`, {
        headers: this.headers,
      }),
    );
    return data.stream_url;
  }

  /**
   * Get thumbnail URL for proxying.
   */
  async getThumbnailUrl(videoId: string): Promise<string> {
    const { data } = await firstValueFrom(
      this.http.get(`${this.proxyUrl}/stream-url/${videoId}`, {
        headers: this.headers,
      }),
    );
    return data.thumbnail || '';
  }

  /**
   * Upsert watch progress. Uses GREATEST to prevent progress regression.
   */
  async upsertProgress(dto: UpdateProgressDto) {
    const existing = await this.prisma.videoWatchProgress.findUnique({
      where: {
        userId_contentId: {
          userId: dto.userId,
          contentId: dto.contentId,
        },
      },
    });

    if (existing) {
      const updatedData: Record<string, any> = {
        watchedSeconds: Math.max(existing.watchedSeconds, dto.watchedSeconds),
        furthestPositionSeconds: Math.max(
          existing.furthestPositionSeconds,
          dto.furthestPositionSeconds ?? 0,
        ),
        watchPercentage: Math.max(existing.watchPercentage, dto.watchPercentage),
        isCompleted: existing.isCompleted || (dto.isCompleted ?? false),
        lastPositionSeconds: dto.lastPositionSeconds ?? existing.lastPositionSeconds,
        seekCount: dto.seekCount ?? existing.seekCount,
        pauseCount: dto.pauseCount ?? existing.pauseCount,
        playCount: Math.max(existing.playCount, dto.playCount ?? 0),
        lastWatchedAt: new Date(),
      };

      if (!existing.isCompleted && dto.isCompleted) {
        updatedData.completedAt = new Date();
      }

      return this.prisma.videoWatchProgress.update({
        where: { id: existing.id },
        data: updatedData,
      });
    }

    return this.prisma.videoWatchProgress.create({
      data: {
        userId: dto.userId,
        contentId: dto.contentId,
        watchedSeconds: dto.watchedSeconds,
        totalDurationSeconds: dto.totalDurationSeconds,
        furthestPositionSeconds: dto.furthestPositionSeconds ?? 0,
        watchPercentage: dto.watchPercentage,
        isCompleted: dto.isCompleted ?? false,
        completedAt: dto.isCompleted ? new Date() : null,
        lastPositionSeconds: dto.lastPositionSeconds ?? 0,
        seekCount: dto.seekCount ?? 0,
        pauseCount: dto.pauseCount ?? 0,
        playCount: dto.playCount ?? 1,
      },
    });
  }

  /**
   * Get user's watch progress for a specific content item.
   */
  async getProgress(userId: string, contentId: string) {
    const row = await this.prisma.videoWatchProgress.findUnique({
      where: {
        userId_contentId: { userId, contentId },
      },
    });

    if (!row) {
      return {
        lastPosition: 0,
        isCompleted: false,
        watchPercentage: 0,
        watchedSeconds: 0,
      };
    }

    return {
      lastPosition: row.lastPositionSeconds,
      isCompleted: row.isCompleted,
      watchPercentage: row.watchPercentage,
      watchedSeconds: row.watchedSeconds,
    };
  }

  /**
   * Admin analytics: per-user completion matrix for a course.
   */
  async getCourseVideoAnalytics(courseId: string) {
    const course = await this.prisma.contentItem.findUnique({
      where: { id: courseId },
      include: {
        courseSections: {
          orderBy: { sortOrder: 'asc' },
          include: {
            items: {
              where: { itemType: 'VIDEO' },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });

    if (!course) return [];

    const videoItems = course.courseSections.flatMap((s) => s.items);
    const contentIds = videoItems.map((i) => i.id);

    if (contentIds.length === 0) return [];

    const progress = await this.prisma.videoWatchProgress.findMany({
      where: { contentId: { in: contentIds } },
    });

    const progressMap = new Map<string, (typeof progress)[number]>();
    for (const p of progress) {
      const key = `${p.userId}:${p.contentId}`;
      progressMap.set(key, p);
    }

    const userIds = [...new Set(progress.map((p) => p.userId))];

    return userIds.map((userId) => ({
      userId,
      items: videoItems.map((item) => {
        const p = progressMap.get(`${userId}:${item.id}`);
        return {
          contentId: item.id,
          title: item.title,
          watchPercentage: p?.watchPercentage ?? 0,
          isCompleted: p?.isCompleted ?? false,
          completedAt: p?.completedAt ?? null,
          playCount: p?.playCount ?? 0,
          seekCount: p?.seekCount ?? 0,
        };
      }),
    }));
  }

  /**
   * When a video is completed:
   *  1. Mark the matching CourseSectionItemProgress as COMPLETED (if the
   *     video belongs to a course the user is enrolled in). Delegates to
   *     CourseEnrollmentService so certificate auto-issuance is triggered.
   *  2. Grant VIDEO_COMPLETE gamification points (idempotent per user+video),
   *     which in turn feeds the user's progression level.
   */
  async syncCompletionToCourseProgress(userId: string, contentId: string) {
    try {
      const enrollments = await this.prisma.courseEnrollment.findMany({
        where: { userId },
        include: {
          itemProgress: {
            where: { sectionItemId: contentId },
          },
        },
      });

      for (const enrollment of enrollments) {
        for (const ip of enrollment.itemProgress) {
          if (ip.status !== 'COMPLETED') {
            await this.courseEnrollmentService.updateItemProgress(
              enrollment.id,
              ip.sectionItemId,
              { status: 'COMPLETED', completedAt: new Date() },
            );
          }
        }
      }
    } catch (err) {
      this.logger.warn(`Failed to sync completion for ${contentId}: ${err}`);
    }

    await this.grantVideoCompletionPoints(userId, contentId);
  }

  /**
   * Grants VIDEO_COMPLETE points the first time a user completes a given
   * video. Subsequent calls are no-ops thanks to the idempotency key.
   * A tenant is required to attribute the grant; users without a tenant
   * are skipped (matching the pattern used by course completion grants).
   */
  private async grantVideoCompletionPoints(userId: string, contentId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { tenantId: true },
      });
      const tenantId = user?.tenantId;
      if (!tenantId) {
        this.logger.debug(
          `Skipping video gamification grant: no tenant for user ${userId}`,
        );
        return;
      }
      await this.gamification.grantPoints({
        userId,
        tenantId,
        reason: POINT_REASONS.VIDEO_COMPLETE,
        sourceType: 'video',
        sourceId: contentId,
        idempotencyKey: `video_complete:${userId}:${contentId}`,
      });
    } catch (err) {
      this.logger.warn(
        `Failed to grant VIDEO_COMPLETE points user=${userId} content=${contentId}: ${err}`,
      );
    }
  }
}
