import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Profile Service — User & tenant profile completion for recommendation optimization
 * omnilearn.space | Afflatus Consulting Group
 */

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async completeUserProfile(
    userId: string,
    data: {
      tenantId?: string;
      companyName?: string;
      companyLogoUrl?: string;
      industryId?: string;
      departmentId?: string;
      positionId?: string;
      linkedinProfileUrl?: string;
      sectorFocus?: string;
    },
  ) {
    let tenantId = data.tenantId;

    // If company name provided and no tenant, create or find tenant
    if (data.companyName && !tenantId) {
      const slug = data.companyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const existing = await this.prisma.tenant.findUnique({ where: { slug } });
      if (existing) {
        tenantId = existing.id;
        if (data.companyLogoUrl && !existing.logoUrl) {
          await this.prisma.tenant.update({
            where: { id: existing.id },
            data: { logoUrl: data.companyLogoUrl },
          });
        }
      } else {
        const created = await this.prisma.tenant.create({
          data: {
            name: data.companyName,
            slug: slug || `company-${Date.now()}`,
            industryId: data.industryId || undefined,
            logoUrl: data.companyLogoUrl || undefined,
          },
        });
        tenantId = created.id;
      }
    }

    const linkedinUrl = data.linkedinProfileUrl?.trim();
    if (linkedinUrl && !this.isValidLinkedInUrl(linkedinUrl)) {
      throw new BadRequestException('Invalid LinkedIn profile URL');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        tenantId: tenantId ?? undefined,
        departmentId: data.departmentId ?? undefined,
        positionId: data.positionId ?? undefined,
        linkedinProfileUrl: linkedinUrl || undefined,
        sectorFocus: data.sectorFocus ?? undefined,
        profileComplete: true,
      },
    });

    return { user, message: 'Profile completed' };
  }

  async getUserProfile(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        department: true,
        position: true,
        tenant: { include: { industry: true } },
      },
    });
    return {
      ...user,
      needsProfileCompletion: !user.profileComplete,
    };
  }

  async getFullUserProfile(userId: string) {
    const [user, enrollments, courseEnrollments, points, badges, streak, trainerProfile] =
      await Promise.all([
        this.prisma.user.findUniqueOrThrow({
          where: { id: userId },
          include: {
            department: true,
            position: true,
            tenant: { include: { industry: true, branding: true } },
            trainerProfile: true,
          },
        }),
        this.prisma.pathEnrollment.findMany({
          where: { userId },
          include: {
            path: { include: { domain: true, steps: true } },
            certificates: {
              include: {
                template: { include: { domain: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.courseEnrollment.findMany({
          where: { userId },
          include: {
            course: { include: { domain: true } },
            certificates: {
              include: {
                template: { include: { domain: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.userPoints
          .findUnique({ where: { userId } })
          .then((p) => p?.points ?? 0),
        this.prisma.userBadge.findMany({
          where: { userId },
          include: { badge: true },
          orderBy: { earnedAt: 'desc' },
        }),
        this.prisma.userStreak.findUnique({ where: { userId } }),
        this.prisma.trainerProfile.findUnique({ where: { userId } }),
      ]);

    const completedEnrollments = enrollments.filter(
      (e) => e.status === 'COMPLETED',
    );
    const activeEnrollments = enrollments.filter(
      (e) => e.status === 'ACTIVE',
    );
    const pathCertificates = enrollments.flatMap((e) =>
      e.certificates.map((c) => ({
        id: c.id,
        verifyCode: c.verifyCode,
        grade: c.grade,
        issuedAt: c.issuedAt,
        pdfUrl: c.pdfUrl,
        domainName: c.template?.domain?.name ?? null,
        templateName: c.template?.templateName ?? null,
        pathName: e.path?.name ?? null,
        courseName: null as string | null,
        certType: 'path' as const,
      })),
    );

    const completedCourseEnrollments = courseEnrollments.filter(
      (e) => e.status === 'COMPLETED',
    );
    const activeCourseEnrollments = courseEnrollments.filter(
      (e) => e.status === 'ACTIVE',
    );
    const courseCertificates = courseEnrollments.flatMap((e) =>
      e.certificates.map((c) => ({
        id: c.id,
        verifyCode: c.verifyCode,
        grade: c.grade,
        issuedAt: c.issuedAt,
        pdfUrl: c.pdfUrl,
        domainName: c.template?.domain?.name ?? null,
        templateName: c.template?.templateName ?? null,
        pathName: null as string | null,
        courseName: e.course?.title ?? null,
        certType: 'course' as const,
      })),
    );

    const allCertificates = [...pathCertificates, ...courseCertificates]
      .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        planId: user.planId,
        billingCycle: user.billingCycle,
        sectorFocus: user.sectorFocus,
        linkedinProfileUrl: user.linkedinProfileUrl,
        emailVerified: user.emailVerified,
        profileComplete: user.profileComplete,
        isAdmin: user.isAdmin,
        trainerApprovedAt: user.trainerApprovedAt,
        createdAt: user.createdAt,
      },
      department: user.department,
      position: user.position,
      company: user.tenant
        ? {
            id: user.tenant.id,
            name: user.tenant.name,
            slug: user.tenant.slug,
            logoUrl: user.tenant.logoUrl,
            industry: user.tenant.industry,
            linkedinProfileUrl: user.tenant.linkedinProfileUrl,
          }
        : null,
      completedPaths: completedEnrollments.map((e) => ({
        id: e.id,
        pathId: e.pathId,
        pathName: e.path?.name,
        domainName: e.path?.domain?.name ?? null,
        domainColor: e.path?.domain?.color ?? null,
        stepCount: e.path?.steps?.length ?? 0,
        progressPct: e.progressPct,
        completedAt: e.completedAt,
      })),
      activePaths: activeEnrollments.map((e) => ({
        id: e.id,
        pathId: e.pathId,
        pathName: e.path?.name,
        domainName: e.path?.domain?.name ?? null,
        domainColor: e.path?.domain?.color ?? null,
        stepCount: e.path?.steps?.length ?? 0,
        progressPct: e.progressPct,
      })),
      completedCourses: completedCourseEnrollments.map((e) => ({
        id: e.id,
        courseId: e.courseId,
        courseName: e.course?.title,
        domainName: e.course?.domain?.name ?? null,
        domainColor: e.course?.domain?.color ?? null,
        progressPct: e.progressPct,
        completedAt: e.completedAt,
      })),
      activeCourses: activeCourseEnrollments.map((e) => ({
        id: e.id,
        courseId: e.courseId,
        courseName: e.course?.title,
        domainName: e.course?.domain?.name ?? null,
        domainColor: e.course?.domain?.color ?? null,
        progressPct: e.progressPct,
      })),
      certificates: allCertificates,
      gamification: {
        points,
        badges: badges.map((b) => ({
          id: b.badge.id,
          name: b.badge.name,
          icon: b.badge.icon,
          description: b.badge.description,
          earnedAt: b.earnedAt,
        })),
        streak: {
          currentStreak: streak?.currentStreak ?? 0,
          longestStreak: streak?.longestStreak ?? 0,
          lastActivityAt: streak?.lastActivityAt ?? null,
        },
      },
      trainerProfile: trainerProfile
        ? {
            headline: trainerProfile.headline,
            bio: trainerProfile.bio,
            specializations: trainerProfile.specializations,
            certifications: trainerProfile.certifications,
            education: trainerProfile.education,
            experience: trainerProfile.experience,
            languages: trainerProfile.languages,
            totalStudents: trainerProfile.totalStudents,
            totalCourses: trainerProfile.totalCourses,
            avgRating: trainerProfile.avgRating,
            slug: trainerProfile.slug,
            status: trainerProfile.status,
          }
        : null,
    };
  }

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        emailVerifyToken: token,
        emailVerifyExpiresAt: { gt: new Date() },
      },
    });
    if (!user) {
      throw new BadRequestException('Invalid or expired verification link');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifyToken: null,
        emailVerifyExpiresAt: null,
      },
    });
    return {
      success: true,
      message: 'Email verified. Please complete your profile.',
      userId: user.id,
    };
  }

  async completeTenantProfile(
    tenantId: string,
    data: {
      industryId?: string;
      linkedinProfileUrl?: string;
      targetMarkets?: string[];
      productsServices?: string[];
      staffingLevel?: string;
    },
  ) {
    const linkedinUrl = data.linkedinProfileUrl?.trim();
    if (linkedinUrl && !this.isValidLinkedInUrl(linkedinUrl)) {
      throw new BadRequestException('Invalid LinkedIn company URL');
    }

    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        industryId: data.industryId ?? undefined,
        linkedinProfileUrl: linkedinUrl || undefined,
        targetMarkets: data.targetMarkets ? (data.targetMarkets as Prisma.InputJsonValue) : undefined,
        productsServices: data.productsServices ? (data.productsServices as Prisma.InputJsonValue) : undefined,
        staffingLevel: data.staffingLevel ?? undefined,
        companyProfileComplete: true,
      },
    });
    return { tenant, message: 'Company profile completed' };
  }

  async getProfileOptions() {
    const [industries, departments, positions, tenants] = await Promise.all([
      this.prisma.industry.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.department.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.position.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.tenant.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, slug: true },
      }),
    ]);
    return { industries, departments, positions, tenants };
  }

  private isValidLinkedInUrl(url: string): boolean {
    return /^https?:\/\/(www\.)?linkedin\.com\/(in|company)\/[\w-]+\/?$/i.test(url);
  }

  /** Current user requests to be a trainer (pending admin approval) */
  async requestTrainerAccess(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { trainerRequested: true },
    });
    return { success: true, message: 'Trainer access requested. An admin will review your request.' };
  }

  /** List users who requested trainer access and are pending approval (admin only) */
  async getPendingTrainerRequests() {
    return this.prisma.user.findMany({
      where: { trainerRequested: true, trainerApprovedAt: null },
      select: { id: true, email: true, name: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Approve a user as trainer — they get INSTRUCTOR role and can create content (admin only) */
  async approveTrainer(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (!user.trainerRequested) {
      throw new BadRequestException('User has not requested trainer access');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { trainerApprovedAt: new Date() },
    });
    return { success: true, message: 'Trainer approved' };
  }

  /** Reject trainer request — user can request again later (admin only) */
  async rejectTrainer(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { trainerRequested: false, trainerApprovedAt: null },
    });
    return { success: true, message: 'Trainer request rejected' };
  }
}
