import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Company Service — Tenant admin + branding
 * omnilearn.space | Afflatus Consulting Group
 */

export interface BrandingDto {
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  customCss?: string;
  settings?: Record<string, unknown>;
}

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

  async listTenants() {
    return this.prisma.tenant.findMany({
      orderBy: { name: 'asc' },
      include: { branding: true },
    });
  }

  /** List users for admin (e.g. content assignment). Optional tenantId filter. */
  async listUsers(tenantId?: string) {
    return this.prisma.user.findMany({
      where: tenantId ? { tenantId } : undefined,
      orderBy: { name: 'asc' },
      select: { id: true, email: true, name: true, tenantId: true },
    });
  }

  /** Tenants with logos that have at least one user (created account / logged in) */
  async getTrustedBy() {
    const tenants = await this.prisma.tenant.findMany({
      where: { users: { some: {} } },
      include: { branding: true },
      orderBy: { name: 'asc' },
    });
    return tenants
      .filter((t) => {
        const logo = t.branding?.logoUrl ?? t.logoUrl;
        return logo != null && logo.trim() !== '';
      })
      .map((t) => ({
        id: t.id,
        name: t.name,
        logoUrl: t.branding?.logoUrl ?? t.logoUrl,
      }));
  }

  async getTenant(id: string) {
    return this.prisma.tenant.findUniqueOrThrow({
      where: { id },
      include: { branding: true, learningPaths: true },
    });
  }

  async createTenant(name: string, slug: string) {
    return this.prisma.tenant.create({
      data: { name, slug },
    });
  }

  async updateTenant(id: string, data: { name?: string; slug?: string; settings?: string }) {
    return this.prisma.tenant.update({
      where: { id },
      data,
    });
  }

  async getBranding(tenantId: string) {
    return this.prisma.tenantBranding.findUnique({
      where: { tenantId },
    });
  }

  async upsertBranding(tenantId: string, data: BrandingDto) {
    const settingsStr = data.settings ? JSON.stringify(data.settings) : undefined;
    return this.prisma.tenantBranding.upsert({
      where: { tenantId },
      create: {
        tenantId,
        logoUrl: data.logoUrl,
        faviconUrl: data.faviconUrl,
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor,
        customCss: data.customCss,
        settings: settingsStr,
      },
      update: {
        logoUrl: data.logoUrl,
        faviconUrl: data.faviconUrl,
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor,
        customCss: data.customCss,
        ...(settingsStr !== undefined && { settings: settingsStr }),
      },
    });
  }
}
