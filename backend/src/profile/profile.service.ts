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
