import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  ApprovalRequestStatus,
  ApprovalRequestType,
  OrgApprovalStatus,
  Prisma,
  UserAccountStatus,
} from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionalEmailService } from '../email/transactional-email.service';
import { SeatLimitService } from '../company/seat-limit.service';
import { RbacRole } from '../constants/rbac.constant';
import type { RequestUserPayload } from '../auth/types/request-user.types';

function generateJoinCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

/**
 * Profile Service — User & tenant profile completion for recommendation optimization
 * omnilearn.space | Afflatus Consulting Group
 */

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionalEmail: TransactionalEmailService,
    private readonly seatLimit: SeatLimitService,
  ) {}

  async completeUserProfile(
    userId: string,
    data: {
      tenantId?: string;
      joinCode?: string;
      companyName?: string;
      companyLogoUrl?: string;
      industryId?: string;
      departmentId?: string;
      positionId?: string;
      linkedinProfileUrl?: string;
      sectorFocus?: string;
      userType?: string;
    },
  ) {
    const userType = data.userType as 'TRAINEE' | 'TRAINER' | 'COMPANY_ADMIN' | undefined;

    let tenantId = data.tenantId;
    let createdNewOrg = false;

    if (data.joinCode && !tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { joinCode: data.joinCode.trim().toUpperCase() },
      });
      if (!tenant) {
        throw new BadRequestException('Invalid company join code. Please check with your company admin.');
      }
      tenantId = tenant.id;
    }

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
            joinCode: generateJoinCode(),
            industryId: data.industryId || undefined,
            logoUrl: data.companyLogoUrl || undefined,
          },
        });
        tenantId = created.id;
        createdNewOrg = true;
      }
    }

    let orgApprovalStatus: string = 'NONE';
    if (tenantId) {
      orgApprovalStatus = createdNewOrg ? 'APPROVED' : 'PENDING';
    }

    const linkedinUrl = data.linkedinProfileUrl?.trim();
    if (linkedinUrl && !this.isValidLinkedInUrl(linkedinUrl)) {
      throw new BadRequestException('Invalid LinkedIn profile URL');
    }

    const updateData: Record<string, unknown> = {
      tenantId: tenantId ?? undefined,
      departmentId: data.departmentId ?? undefined,
      positionId: data.positionId ?? undefined,
      linkedinProfileUrl: linkedinUrl || undefined,
      sectorFocus: data.sectorFocus ?? undefined,
      profileComplete: true,
      userType: userType ?? undefined,
      orgApprovalStatus,
    };

    if (userType === 'TRAINER') {
      updateData.trainerRequested = true;
    }
    if (userType === 'COMPANY_ADMIN') {
      updateData.companyAdminRequested = true;
    }

    if (tenantId && orgApprovalStatus === 'APPROVED') {
      await this.seatLimit.assertSeatAvailable(tenantId);
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return { user, message: 'Profile completed' };
  }

  async updateDemographics(
    userId: string,
    data: {
      gender?: string;
      dateOfBirth?: string;
      country?: string;
      countryCode?: string;
      city?: string;
      timezone?: string;
      phoneNumber?: string;
    },
  ) {
    const updateData: Record<string, unknown> = {};
    if (data.gender !== undefined) updateData.gender = data.gender || null;
    if (data.dateOfBirth !== undefined) updateData.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
    if (data.country !== undefined) updateData.country = data.country || null;
    if (data.countryCode !== undefined) updateData.countryCode = data.countryCode || null;
    if (data.city !== undefined) updateData.city = data.city || null;
    if (data.timezone !== undefined) updateData.timezone = data.timezone || null;
    if (data.phoneNumber !== undefined) updateData.phoneNumber = data.phoneNumber || null;

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        gender: true,
        dateOfBirth: true,
        country: true,
        countryCode: true,
        city: true,
        timezone: true,
        phoneNumber: true,
      },
    });
    return { user, message: 'Demographics updated' };
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
    return this.buildFullProfilePayload(userId);
  }

  /**
   * Full profile for deep analytics / admin viewer. Same shape as getFullUserProfile plus tenantId on user slice.
   * Enforces tenant scope for non–super-admins.
   */
  async getFullProfileForAdmin(actor: RequestUserPayload, targetUserId: string) {
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, tenantId: true },
    });
    if (!target) throw new NotFoundException('User not found');

    const isSuper = actor.roles.includes(RbacRole.SUPER_ADMIN);
    if (!isSuper && target.tenantId !== actor.tenantId) {
      throw new ForbiddenException('You can only view users in your own academy');
    }

    return this.buildFullProfilePayload(targetUserId);
  }

  private async buildFullProfilePayload(userId: string) {
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
        tenantId: user.tenantId,
        planId: user.planId,
        billingCycle: user.billingCycle,
        sectorFocus: user.sectorFocus,
        linkedinProfileUrl: user.linkedinProfileUrl,
        emailVerified: user.emailVerified,
        profileComplete: user.profileComplete,
        isAdmin: user.isAdmin,
        trainerApprovedAt: user.trainerApprovedAt,
        userType: user.userType,
        orgApprovalStatus: user.orgApprovalStatus,
        companyAdminRequested: user.companyAdminRequested,
        companyAdminApprovedAt: user.companyAdminApprovedAt,
        gender: user.gender,
        dateOfBirth: user.dateOfBirth,
        country: user.country,
        city: user.city,
        phoneNumber: user.phoneNumber,
        accountStatus: user.accountStatus,
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
    const now = new Date();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    // Single atomic UPDATE so concurrent verify requests cannot both enqueue welcome/activation emails.
    const applied = await this.prisma.$queryRaw<Array<{ id: string }>>`
      UPDATE "User"
      SET "emailVerified" = true,
          "emailVerifyToken" = null,
          "emailVerifyExpiresAt" = null
      WHERE "emailVerifyToken" = ${tokenHash}
        AND "emailVerifyExpiresAt" > ${now}
      RETURNING id
    `;
    if (!applied.length) {
      throw new BadRequestException('Invalid or expired verification link');
    }
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: applied[0].id },
      include: { tenant: true },
    });

    if (user.tenantId && user.orgApprovalStatus === OrgApprovalStatus.PENDING) {
      await this.transactionalEmail.notifyCompanyAdminsNewSignup({
        tenantId: user.tenantId,
        learnerName: user.name,
        learnerEmail: user.email,
      });
    } else {
      await this.transactionalEmail.sendAccountActivated({
        userId: user.id,
        toEmail: user.email,
        toName: user.name,
      });
    }

    return {
      success: true,
      message:
        user.tenantId && user.orgApprovalStatus === OrgApprovalStatus.PENDING
          ? 'Email verified. Your organization administrator will review your access.'
          : 'Email verified. Please complete your profile.',
      userId: user.id,
      pendingOrgApproval: user.orgApprovalStatus === OrgApprovalStatus.PENDING,
    };
  }

  async completeTenantProfile(
    tenantId: string,
    actorUserId: string,
    data: {
      industryId?: string;
      linkedinProfileUrl?: string;
      targetMarkets?: string[];
      productsServices?: string[];
      staffingLevel?: string;
    },
  ) {
    const actor = await this.prisma.user.findUnique({ where: { id: actorUserId } });
    if (!actor) throw new ForbiddenException();
    if (!actor.isAdmin && actor.tenantId !== tenantId) {
      throw new ForbiddenException('You can only manage your own organization profile');
    }

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
    const [industries, departments, positions] = await Promise.all([
      this.prisma.industry.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.department.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.position.findMany({ orderBy: { name: 'asc' } }),
    ]);
    return { industries, departments, positions };
  }

  async resolveJoinCode(code: string) {
    if (!code?.trim()) return { valid: false };
    const tenant = await this.prisma.tenant.findUnique({
      where: { joinCode: code.trim().toUpperCase() },
      select: { id: true, name: true, logoUrl: true },
    });
    if (!tenant) return { valid: false };
    return { valid: true, tenantId: tenant.id, tenantName: tenant.name, tenantLogoUrl: tenant.logoUrl };
  }

  /**
   * Authenticated user requests to join a branded academy (pending company-admin approval).
   */
  async requestAcademyJoin(userId: string, tenantId: string) {
    if (!tenantId?.trim()) {
      throw new BadRequestException('tenantId is required');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, settings: true },
    });
    if (!tenant) {
      throw new BadRequestException('Academy not found');
    }

    const settings = (tenant.settings ?? {}) as Record<string, unknown>;
    if (settings.accountType !== 'branded_academy') {
      throw new BadRequestException('This organization does not accept academy join requests');
    }
    if (settings.allowSelfSignup === false) {
      throw new BadRequestException('This academy does not allow self-service join requests');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, tenantId: true, orgApprovalStatus: true, emailVerified: true },
    });
    if (!user) throw new BadRequestException('User not found');

    if (user.orgApprovalStatus === OrgApprovalStatus.APPROVED && user.tenantId === tenantId) {
      return {
        success: true,
        alreadyMember: true,
        message: 'You are already an approved member of this academy',
      };
    }
    if (user.orgApprovalStatus === OrgApprovalStatus.APPROVED && user.tenantId && user.tenantId !== tenantId) {
      throw new BadRequestException(
        'You already belong to another academy. Ask a platform administrator to move your account.',
      );
    }

    await this.prisma.approvalRequest.updateMany({
      where: {
        requesterId: userId,
        type: ApprovalRequestType.COMPANY_JOIN,
        status: ApprovalRequestStatus.PENDING,
      },
      data: {
        status: ApprovalRequestStatus.REJECTED,
        reviewNote: 'Superseded by a new academy join request',
        reviewedAt: new Date(),
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        tenantId,
        orgApprovalStatus: OrgApprovalStatus.PENDING,
        accountStatus: UserAccountStatus.PENDING_COMPANY,
      },
    });

    await this.prisma.approvalRequest.create({
      data: {
        tenantId,
        type: ApprovalRequestType.COMPANY_JOIN,
        status: ApprovalRequestStatus.PENDING,
        requesterId: userId,
        payload: { company_tenant_id: tenantId, message: 'user_requested_academy_join' },
      },
    });

    if (user.emailVerified) {
      await this.transactionalEmail.notifyCompanyAdminsNewSignup({
        tenantId,
        learnerName: user.name,
        learnerEmail: user.email,
      });
    }

    return {
      success: true,
      pending: true,
      tenantId,
      tenantName: tenant.name,
      message: 'Your request was sent. A company administrator will review your access.',
    };
  }

  /** User leaves their current academy (clears pending or approved affiliation). */
  async leaveAcademy(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, tenantId: true, orgApprovalStatus: true },
    });
    if (!user?.tenantId) {
      return { success: true, message: 'You are not affiliated with an academy' };
    }

    await this.prisma.approvalRequest.updateMany({
      where: {
        requesterId: userId,
        type: ApprovalRequestType.COMPANY_JOIN,
        status: ApprovalRequestStatus.PENDING,
      },
      data: {
        status: ApprovalRequestStatus.REJECTED,
        reviewNote: 'User withdrew academy join request',
        reviewedAt: new Date(),
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        tenantId: null,
        orgApprovalStatus: OrgApprovalStatus.NONE,
        accountStatus: UserAccountStatus.ACTIVE,
      },
    });

    return { success: true, message: 'You have left the academy' };
  }

  async getReferralCompany(userId: string) {
    const referral = await this.prisma.referral.findFirst({
      where: { referredUserId: userId },
      orderBy: { createdAt: 'desc' },
      select: { referrerId: true },
    });
    if (!referral) return null;
    const referrer = await this.prisma.user.findUnique({
      where: { id: referral.referrerId },
      select: { tenantId: true, tenant: { select: { id: true, name: true, logoUrl: true } } },
    });
    if (!referrer?.tenant) return null;
    return {
      tenantId: referrer.tenant.id,
      tenantName: referrer.tenant.name,
      tenantLogoUrl: referrer.tenant.logoUrl,
    };
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
  async getPendingTrainerRequests(actor: { isAdmin: boolean; tenantId: string | null }) {
    const where: Record<string, unknown> = { trainerRequested: true, trainerApprovedAt: null };
    if (!actor.isAdmin && actor.tenantId) {
      where.tenantId = actor.tenantId;
    }
    return this.prisma.user.findMany({
      where,
      select: { id: true, email: true, name: true, tenantId: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Approve a user as trainer — they get INSTRUCTOR role and can create content (admin only) */
  async approveTrainer(userId: string, actor: { isAdmin: boolean; tenantId: string | null }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (!user.trainerRequested) {
      throw new BadRequestException('User has not requested trainer access');
    }
    if (!actor.isAdmin && actor.tenantId !== user.tenantId) {
      throw new ForbiddenException('You can only approve trainers in your own organization');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { trainerApprovedAt: new Date() },
    });
    return { success: true, message: 'Trainer approved' };
  }

  /** Reject trainer request — user can request again later (admin only) */
  async rejectTrainer(userId: string, actor: { isAdmin: boolean; tenantId: string | null }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (!actor.isAdmin && actor.tenantId !== user.tenantId) {
      throw new ForbiddenException('You can only reject trainers in your own organization');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { trainerRequested: false, trainerApprovedAt: null },
    });
    return { success: true, message: 'Trainer request rejected' };
  }

  /** List users pending org affiliation approval for a given tenant (company admin) */
  async getPendingOrgAffiliations(tenantId: string, actorUserId: string) {
    const actor = await this.prisma.user.findUnique({ where: { id: actorUserId } });
    if (!actor) throw new ForbiddenException();
    if (!actor.isAdmin && actor.tenantId !== tenantId) {
      throw new ForbiddenException();
    }
    return this.prisma.user.findMany({
      where: { tenantId, orgApprovalStatus: OrgApprovalStatus.PENDING },
      select: { id: true, email: true, name: true, userType: true, createdAt: true, emailVerified: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Approve a user's organization affiliation (company admin) */
  async approveOrgAffiliation(userId: string, actorUserId: string) {
    const actor = await this.prisma.user.findUnique({ where: { id: actorUserId } });
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { tenant: true } });
    if (!user) throw new BadRequestException('User not found');
    if (!actor) throw new ForbiddenException();
    if (user.orgApprovalStatus !== OrgApprovalStatus.PENDING) {
      throw new BadRequestException('No pending affiliation request for this user');
    }
    if (!user.emailVerified) {
      throw new BadRequestException('User must verify their email before approval');
    }
    if (!actor.isAdmin) {
      if (!actor.companyAdminApprovedAt) throw new ForbiddenException();
      if (user.tenantId !== actor.tenantId) throw new ForbiddenException();
    }
    await this.prisma.$transaction(async (tx) => {
      if (user.tenantId) {
        await this.seatLimit.assertSeatAvailable(user.tenantId, 1, tx);
      }
      await tx.user.update({
        where: { id: userId },
        data: {
          orgApprovalStatus: OrgApprovalStatus.APPROVED,
          accountStatus: UserAccountStatus.ACTIVE,
        },
      });
    });
    await this.transactionalEmail.sendAccountApproved({
      userId: user.id,
      toEmail: user.email,
      toName: user.name,
      tenantName: user.tenant?.name ?? 'your organization',
    });
    return { success: true, message: 'Organization affiliation approved' };
  }

  /** Reject a user's organization affiliation — clears tenantId (company admin) */
  async rejectOrgAffiliation(userId: string, actorUserId: string, reason?: string) {
    const actor = await this.prisma.user.findUnique({ where: { id: actorUserId } });
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');
    if (!actor) throw new ForbiddenException();
    if (user.orgApprovalStatus !== OrgApprovalStatus.PENDING) {
      throw new BadRequestException('No pending affiliation request for this user');
    }
    if (!actor.isAdmin) {
      if (!actor.companyAdminApprovedAt) throw new ForbiddenException();
      if (user.tenantId !== actor.tenantId) throw new ForbiddenException();
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { orgApprovalStatus: OrgApprovalStatus.REJECTED, tenantId: null },
    });
    await this.transactionalEmail.sendAccountRejected({
      userId: user.id,
      toEmail: user.email,
      toName: user.name,
      reason,
    });
    return { success: true, message: 'Organization affiliation rejected' };
  }

  async getEmailPreferences(userId: string) {
    const rows = await this.prisma.userEmailPreference.findMany({
      where: { userId },
      select: { eventType: true, isEnabled: true, updatedAt: true },
    });
    return { preferences: rows };
  }

  async upsertEmailPreference(userId: string, eventType: string, isEnabled: boolean) {
    const row = await this.prisma.userEmailPreference.upsert({
      where: { userId_eventType: { userId, eventType } },
      create: { userId, eventType, isEnabled },
      update: { isEnabled },
    });
    return { preference: row };
  }

  /** Tracks views/previews/etc. for the content suggestion engine */
  async recordContentInteraction(
    userId: string,
    dto: { contentId: string; contentType: string; interactionType: string },
  ) {
    return this.prisma.userContentInteraction.upsert({
      where: {
        userId_contentId_contentType_interactionType: {
          userId,
          contentId: dto.contentId,
          contentType: dto.contentType,
          interactionType: dto.interactionType,
        },
      },
      update: {
        interactionCount: { increment: 1 },
        lastInteractionAt: new Date(),
      },
      create: {
        userId,
        contentId: dto.contentId,
        contentType: dto.contentType,
        interactionType: dto.interactionType,
      },
    });
  }

  /** List users who requested company admin role and are pending platform admin approval */
  async getPendingCompanyAdminRequests() {
    return this.prisma.user.findMany({
      where: { companyAdminRequested: true, companyAdminApprovedAt: null },
      select: { id: true, email: true, name: true, tenantId: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Approve a user as company admin — grants COMPANY_ADMIN role (platform admin only) */
  async approveCompanyAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');
    if (!user.companyAdminRequested) {
      throw new BadRequestException('User has not requested company admin access');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { companyAdminApprovedAt: new Date() },
    });
    return { success: true, message: 'Company admin approved' };
  }

  /** Reject company admin request (platform admin only) */
  async rejectCompanyAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');
    await this.prisma.user.update({
      where: { id: userId },
      data: { companyAdminRequested: false, companyAdminApprovedAt: null },
    });
    return { success: true, message: 'Company admin request rejected' };
  }

  /**
   * One-click toggle of a user's Company Admin role (platform admin only).
   * - If the user is currently a Company Admin, demote (clear request + approval).
   * - Otherwise, promote (stamp approval and mark requested for audit consistency).
   * Refuses to operate on Super Admins (the role is moot) or on the actor themselves
   * to avoid accidental self-changes from the academy UI.
   */
  async toggleCompanyAdmin(targetUserId: string, actorUserId: string) {
    if (targetUserId === actorUserId) {
      throw new BadRequestException('You cannot toggle your own company admin role');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        isAdmin: true,
        tenantId: true,
        companyAdminRequested: true,
        companyAdminApprovedAt: true,
      },
    });
    if (!user) throw new BadRequestException('User not found');
    if (user.isAdmin) {
      throw new BadRequestException(
        'Platform admins do not need a company admin role',
      );
    }

    const isCurrentlyCompanyAdmin = !!user.companyAdminApprovedAt;

    if (isCurrentlyCompanyAdmin) {
      await this.prisma.user.update({
        where: { id: targetUserId },
        data: { companyAdminRequested: false, companyAdminApprovedAt: null },
      });
      return {
        userId: targetUserId,
        role: 'member',
        companyAdmin: false,
        message: 'User demoted from Company Admin',
      };
    }

    await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        companyAdminRequested: true,
        companyAdminApprovedAt: new Date(),
      },
    });
    return {
      userId: targetUserId,
      role: 'company_admin',
      companyAdmin: true,
      message: 'User promoted to Company Admin',
    };
  }
}
