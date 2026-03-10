import { Injectable, BadRequestException } from '@nestjs/common';
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
      } else {
        const created = await this.prisma.tenant.create({
          data: {
            name: data.companyName,
            slug: slug || `company-${Date.now()}`,
            industryId: data.industryId || undefined,
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
        targetMarkets: data.targetMarkets ? (data.targetMarkets as unknown) : undefined,
        productsServices: data.productsServices ? (data.productsServices as unknown) : undefined,
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
}
