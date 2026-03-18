import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertTrainerProfileDto } from '../dto/trainer-profile.dto';

@Injectable()
export class TrainerProfileService {
  constructor(private readonly prisma: PrismaService) {}

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

  async refreshStats(userId: string) {
    const contentCount = await this.prisma.contentItem.count({
      where: { tenantId: null, tenantAssignments: { none: {} } },
    });

    return this.prisma.trainerProfile.update({
      where: { userId },
      data: { totalCourses: contentCount },
    });
  }

  private async resolveSlug(name: string, userId: string): Promise<string> {
    const existing = await this.prisma.trainerProfile.findUnique({ where: { userId } });
    if (existing) return existing.slug;

    let base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (!base) base = 'trainer';

    const taken = await this.prisma.trainerProfile.findUnique({ where: { slug: base } });
    if (!taken) return base;

    return `${base}-${userId.slice(0, 8)}`;
  }
}
