import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Company Service — Tenant admin + branding + enterprise leads
 * omnilearn.space | Afflatus Consulting Group
 */

export interface BrandingDto {
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  appName?: string;
  tagline?: string;
  loginBgUrl?: string;
  emailLogoUrl?: string;
  fontFamily?: string;
  navStyle?: string;
  customCss?: string;
  settings?: Record<string, unknown>;
}

export interface EnterpriseLeadDto {
  company: string;
  email: string;
  name?: string;
  message?: string;
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

  /** Platform stats: total user count + trusted company logos for landing page */
  async getPlatformStats() {
    const [userCount, tenants] = await Promise.all([
      this.prisma.user.count(),
      this.getTrustedBy(),
    ]);
    return { userCount, trustedCompanies: tenants };
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
    const brandingFields = {
      logoUrl: data.logoUrl,
      faviconUrl: data.faviconUrl,
      primaryColor: data.primaryColor,
      secondaryColor: data.secondaryColor,
      accentColor: data.accentColor,
      appName: data.appName,
      tagline: data.tagline,
      loginBgUrl: data.loginBgUrl,
      emailLogoUrl: data.emailLogoUrl,
      fontFamily: data.fontFamily,
      navStyle: data.navStyle,
      customCss: data.customCss,
    };
    return this.prisma.tenantBranding.upsert({
      where: { tenantId },
      create: {
        tenantId,
        ...brandingFields,
        settings: settingsStr,
      },
      update: {
        ...brandingFields,
        ...(settingsStr !== undefined && { settings: settingsStr }),
      },
    });
  }

  private static RESERVED_SLUGS = new Set([
    'signin', 'signup', 'login', 'learn', 'discover', 'forum', 'admin',
    'trainer', 'referrals', 'checkout', 'course', 'content', 'micro',
    'certificates', 'about', 'contact', 'privacy', 'terms', 'press',
    'modern-slavery', 'what-we-offer', 'verify-email', 'complete-profile',
    'auth', 'api', 'app', 'static', '_next',
  ]);

  async getTenantPortal(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      include: {
        branding: true,
        industry: true,
        ssoConfigs: { where: { isEnabled: true }, select: { provider: true } },
        _count: { select: { users: true, learningPaths: true, domains: true } },
      },
    });
    if (!tenant) return null;

    const branding = tenant.branding;
    return {
      id: tenant.id,
      name: branding?.appName || tenant.name,
      slug: tenant.slug,
      logoUrl: branding?.logoUrl || tenant.logoUrl,
      industry: tenant.industry?.name ?? null,
      branding: branding ? {
        primaryColor: branding.primaryColor,
        secondaryColor: branding.secondaryColor,
        accentColor: branding.accentColor,
        appName: branding.appName,
        tagline: branding.tagline,
        logoUrl: branding.logoUrl,
        faviconUrl: branding.faviconUrl,
        loginBgUrl: branding.loginBgUrl,
        fontFamily: branding.fontFamily,
        navStyle: branding.navStyle,
        customCss: branding.customCss,
      } : null,
      ssoProviders: tenant.ssoConfigs.map((c) => c.provider),
      stats: {
        users: tenant._count.users,
        learningPaths: tenant._count.learningPaths,
        domains: tenant._count.domains,
      },
    };
  }

  isReservedSlug(slug: string): boolean {
    return CompanyService.RESERVED_SLUGS.has(slug.toLowerCase());
  }

  /** Store enterprise sales lead as an AnalyticsEvent */
  async createEnterpriseLead(lead: EnterpriseLeadDto) {
    return this.prisma.analyticsEvent.create({
      data: {
        eventType: 'ENTERPRISE_LEAD',
        payload: {
          company: lead.company,
          email: lead.email,
          name: lead.name ?? null,
          message: lead.message ?? null,
        },
      },
    });
  }

  /** Compute real enrollment analytics for users in a tenant */
  async getEmployeeAnalytics(tenantId: string) {
    const users = await this.prisma.user.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (users.length === 0) return [];

    const userIds = users.map((u) => u.id);
    const enrollments = await this.prisma.pathEnrollment.findMany({
      where: { userId: { in: userIds } },
      select: {
        userId: true,
        status: true,
        progressPct: true,
      },
    });

    const enrollmentsByUser = new Map<string, typeof enrollments>();
    for (const e of enrollments) {
      const list = enrollmentsByUser.get(e.userId) ?? [];
      list.push(e);
      enrollmentsByUser.set(e.userId, list);
    }

    return users.map((u) => {
      const userEnrollments = enrollmentsByUser.get(u.id) ?? [];
      const totalEnrollments = userEnrollments.length;
      const avgProgress =
        totalEnrollments > 0
          ? Math.round(
              userEnrollments.reduce((sum, e) => sum + e.progressPct, 0) /
                totalEnrollments,
            )
          : 0;
      return {
        userId: u.id,
        name: u.name ?? 'Unknown',
        email: u.email,
        enrollments: totalEnrollments,
        completedPct: avgProgress,
      };
    });
  }
}
