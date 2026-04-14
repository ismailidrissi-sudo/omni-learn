import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertTrainerProfileDto } from '../dto/trainer-profile.dto';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class TrainerProfileService {
  constructor(private readonly prisma: PrismaService) {}

  private get avatarStoragePath(): string {
    const base = process.env.TRAINER_AVATAR_STORAGE_PATH || process.env.DOCUMENT_STORAGE_PATH || './data/documents';
    return join(base, 'trainer-avatars');
  }

  async upsert(userId: string, dto: UpsertTrainerProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');
    if (!user.trainerApprovedAt && !user.isAdmin) {
      throw new ForbiddenException('Only approved trainers can create a profile');
    }

    const slug = await this.resolveSlug(user.name, userId);

    const data: Prisma.TrainerProfileUncheckedUpdateInput = {
      headline: dto.headline,
      bio: dto.bio,
      photoUrl: dto.photoUrl,
      bannerUrl: dto.bannerUrl,
      resumeUrl: dto.resumeUrl,
      specializations: dto.specializations as Prisma.InputJsonValue,
      certifications: dto.certifications as unknown as Prisma.InputJsonValue,
      distinctions: dto.distinctions as unknown as Prisma.InputJsonValue,
      languages: dto.languages as Prisma.InputJsonValue,
      socialLinks: dto.socialLinks as unknown as Prisma.InputJsonValue,
      education: dto.education as unknown as Prisma.InputJsonValue,
      experience: dto.experience as unknown as Prisma.InputJsonValue,
      expertiseDomains: dto.expertiseDomains as unknown as Prisma.InputJsonValue,
      availability: dto.availability as unknown as Prisma.InputJsonValue,
      websiteUrl: dto.websiteUrl,
      location: dto.location,
      timezone: dto.timezone,
      yearsOfExperience: dto.yearsOfExperience,
      hourlyRate: dto.hourlyRate,
      currency: dto.currency,
      availableForHire: dto.availableForHire,
      contactEmail: dto.contactEmail,
      featuredVideoUrl: dto.featuredVideoUrl,
    };

    const stripped = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined),
    );

    const profile = await this.prisma.trainerProfile.upsert({
      where: { userId },
      update: stripped,
      create: {
        userId,
        slug,
        ...stripped,
      } as Prisma.TrainerProfileUncheckedCreateInput,
    });

    return profile;
  }

  async saveAvatarFile(buffer: Buffer, mimetype: string): Promise<string> {
    const allowed: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
    };
    const ext = allowed[mimetype];
    if (!ext) throw new BadRequestException('Only JPEG, PNG, and WebP images are allowed');

    mkdirSync(this.avatarStoragePath, { recursive: true });
    const filename = `${randomUUID()}${ext}`;
    const filePath = join(this.avatarStoragePath, filename);
    writeFileSync(filePath, buffer);

    return `/trainer-profiles/avatar-files/${filename}`;
  }

  getAvatarFileBuffer(filename: string): { buffer: Buffer; mime: string } | null {
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '');
    if (!safe) return null;
    const filePath = join(this.avatarStoragePath, safe);
    if (!existsSync(filePath)) return null;
    const ext = extname(safe).toLowerCase();
    const mime =
      ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    return { buffer: readFileSync(filePath), mime };
  }

  async getMyProfile(userId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({
      where: { userId },
      include: { user: { select: { id: true, name: true, email: true, linkedinProfileUrl: true } } },
    });
    return profile;
  }

  async setStatus(userId: string, status: 'DRAFT' | 'PUBLISHED') {
    const profile = await this.prisma.trainerProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Create your profile first');

    if (status === 'PUBLISHED' && !profile.headline && !profile.bio) {
      throw new BadRequestException('Add at least a headline or bio before publishing');
    }

    return this.prisma.trainerProfile.update({
      where: { userId },
      data: { status },
    });
  }

  async getPublicProfile(slug: string) {
    const profile = await this.prisma.trainerProfile.findUnique({
      where: { slug, status: 'PUBLISHED' },
      include: { user: { select: { id: true, name: true, linkedinProfileUrl: true } } },
    });
    if (!profile) throw new NotFoundException('Trainer profile not found');

    const content = await this.prisma.contentItem.findMany({
      where: {
        createdById: profile.userId,
        tenantId: null,
        tenantAssignments: { none: {} },
      },
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        durationMinutes: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return { ...profile, content };
  }

  async listPublicProfiles(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;
    const where: Prisma.TrainerProfileWhereInput = {
      status: 'PUBLISHED',
      ...(search
        ? {
            OR: [
              { headline: { contains: search, mode: 'insensitive' } },
              { bio: { contains: search, mode: 'insensitive' } },
              { user: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [profiles, total] = await Promise.all([
      this.prisma.trainerProfile.findMany({
        where,
        include: { user: { select: { id: true, name: true } } },
        orderBy: { totalStudents: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.trainerProfile.count({ where }),
    ]);

    return { profiles, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async computeStats(userId: string) {
    const contentWhere = {
      createdById: userId,
      tenantId: null,
      tenantAssignments: { none: {} },
    };

    const contentCount = await this.prisma.contentItem.count({ where: contentWhere });

    const contentIds = (
      await this.prisma.contentItem.findMany({
        where: contentWhere,
        select: { id: true },
      })
    ).map((c) => c.id);

    const distinctLearners =
      contentIds.length === 0
        ? []
        : await this.prisma.courseEnrollment.findMany({
            where: { courseId: { in: contentIds } },
            distinct: ['userId'],
            select: { userId: true },
          });

    const reviews =
      contentIds.length === 0
        ? []
        : await this.prisma.courseReview.findMany({
            where: { contentId: { in: contentIds } },
            select: { rating: true },
          });

    const avgRating =
      reviews.length > 0
        ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
        : null;

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const recentContent = await this.prisma.contentItem.count({
      where: {
        ...contentWhere,
        updatedAt: { gte: since },
      },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { createdAt: true },
    });

    const accountYears = user
      ? Math.max(0, Math.floor((Date.now() - user.createdAt.getTime()) / (365.25 * 24 * 60 * 60 * 1000)))
      : 0;

    return {
      totalCourses: contentCount,
      totalStudents: distinctLearners.length,
      avgRating,
      activeLast30Days: recentContent > 0,
      accountYears,
      reviewCount: reviews.length,
    };
  }

  async refreshStats(userId: string) {
    const s = await this.computeStats(userId);

    return this.prisma.trainerProfile.update({
      where: { userId },
      data: {
        totalCourses: s.totalCourses,
        totalStudents: s.totalStudents,
        avgRating: s.avgRating,
      },
    });
  }

  async getMyStats(userId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Create your profile first');

    const computed = await this.computeStats(userId);
    return {
      ...computed,
      slug: profile.slug,
      status: profile.status,
    };
  }

  async getMyReviews(userId: string, limit = 20, offset = 0) {
    return this.listReviewsForAuthor(userId, limit, offset);
  }

  async getPublicReviews(slug: string, limit = 20, offset = 0) {
    const profile = await this.prisma.trainerProfile.findUnique({
      where: { slug, status: 'PUBLISHED' },
    });
    if (!profile) throw new NotFoundException('Trainer profile not found');
    return this.listReviewsForAuthor(profile.userId, limit, offset);
  }

  private async listReviewsForAuthor(authorUserId: string, limit: number, offset: number) {
    const contentIds = (
      await this.prisma.contentItem.findMany({
        where: { createdById: authorUserId },
        select: { id: true },
      })
    ).map((c) => c.id);

    if (contentIds.length === 0) {
      return { reviews: [] as unknown[], total: 0 };
    }

    const [reviews, total] = await Promise.all([
      this.prisma.courseReview.findMany({
        where: { contentId: { in: contentIds } },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.courseReview.count({ where: { contentId: { in: contentIds } } }),
    ]);

    const titles = await this.prisma.contentItem.findMany({
      where: { id: { in: [...new Set(reviews.map((r) => r.contentId))] } },
      select: { id: true, title: true },
    });
    const titleById = Object.fromEntries(titles.map((t) => [t.id, t.title]));

    const mapped = reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      commentaire: r.review,
      date: r.createdAt,
      apprenant_nom: r.user.name ?? 'Learner',
      apprenant_avatar: null as string | null,
      contenu_concerne: titleById[r.contentId] ?? null,
      contentId: r.contentId,
    }));

    return { reviews: mapped, total };
  }

  private async resolveSlug(name: string, userId: string): Promise<string> {
    const existing = await this.prisma.trainerProfile.findUnique({ where: { userId } });
    if (existing) return existing.slug;

    let base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (!base) base = 'trainer';

    let candidate = base;
    let n = 2;
    while (true) {
      const taken = await this.prisma.trainerProfile.findUnique({ where: { slug: candidate } });
      if (!taken) return candidate;
      candidate = `${base}-${n}`;
      n += 1;
    }
  }
}
