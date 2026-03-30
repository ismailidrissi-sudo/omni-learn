import { Injectable } from '@nestjs/common';
import { Prisma, TenantBranding } from '@prisma/client';
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
  /** When true, removes bytes from TenantBranding (URL fields unchanged unless also sent). */
  clearStoredLogo?: boolean;
}

export type SanitizedTenantBranding = Omit<TenantBranding, 'logoData'> & {
  hasStoredLogo: boolean;
};

export interface EnterpriseLeadDto {
  company: string;
  email: string;
  name?: string;
  message?: string;
}

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

  /** Absolute or root-relative URL served by GET /company/tenants/:id/logo */
  storedLogoPublicUrl(tenantId: string): string {
    const path = `/company/tenants/${tenantId}/logo`;
    const base = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
    return base ? `${base}${path}` : path;
  }

  static storedLogoBytesLen(logoData: TenantBranding['logoData']): number {
    if (logoData == null) return 0;
    const b = logoData as unknown;
    if (Buffer.isBuffer(b)) return b.length;
    if (b instanceof Uint8Array) return b.byteLength;
    return 0;
  }

  resolveDisplayLogoUrl(
    tenantId: string,
    branding: Pick<TenantBranding, 'logoUrl' | 'logoData'> | null,
    tenantFallbackLogoUrl: string | null | undefined,
  ): string | null {
    if (branding && CompanyService.storedLogoBytesLen(branding.logoData) > 0) {
      return this.storedLogoPublicUrl(tenantId);
    }
    const u = branding?.logoUrl ?? tenantFallbackLogoUrl;
    if (u != null && String(u).trim() !== '') return String(u).trim();
    return null;
  }

  sanitizeBranding(tenantId: string, row: TenantBranding): SanitizedTenantBranding {
    const { logoData: _drop, ...rest } = row;
    const hasStoredLogo = CompanyService.storedLogoBytesLen(row.logoData) > 0;
    const resolved = this.resolveDisplayLogoUrl(tenantId, row, null);
    return {
      ...rest,
      logoUrl: resolved ?? rest.logoUrl,
      hasStoredLogo,
    } as SanitizedTenantBranding;
  }

  async getTenantLogoFile(tenantId: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
    const row = await this.prisma.tenantBranding.findUnique({
      where: { tenantId },
      select: { logoData: true, logoMimeType: true },
    });
    if (!row?.logoData) return null;
    const len = CompanyService.storedLogoBytesLen(row.logoData);
    if (len === 0) return null;
    const buffer = Buffer.isBuffer(row.logoData) ? row.logoData : Buffer.from(row.logoData as Uint8Array);
    return {
      buffer,
      mimeType: row.logoMimeType?.trim() || 'image/png',
    };
  }

  async saveTenantLogoBytes(tenantId: string, buffer: Buffer, mimeType: string): Promise<void> {
    await this.prisma.tenantBranding.upsert({
      where: { tenantId },
      create: {
        tenantId,
        logoData: buffer,
        logoMimeType: mimeType,
      },
      update: {
        logoData: buffer,
        logoMimeType: mimeType,
      },
    });
  }

  async clearTenantLogoBytes(tenantId: string): Promise<void> {
    await this.prisma.tenantBranding.updateMany({
      where: { tenantId },
      data: { logoData: null, logoMimeType: null },
    });
  }

  async listTenants() {
    const rows = await this.prisma.tenant.findMany({
      orderBy: { name: 'asc' },
      include: { branding: true },
    });
    return rows.map((t) => ({
      ...t,
      branding: t.branding ? this.sanitizeBranding(t.id, t.branding) : null,
    }));
  }

  /** List users for admin (e.g. content assignment). Optional tenantId filter. */
  async listUsers(tenantId?: string) {
    return this.prisma.user.findMany({
      where: tenantId ? { tenantId } : undefined,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        email: true,
        name: true,
        tenantId: true,
        country: true,
        countryCode: true,
        city: true,
        timezone: true,
      },
    });
  }

  /** Aggregated counts for admin map (English country names in DB). */
  async usersGeoDistribution(opts: {
    filterTenantId?: string;
    actorTenantId: string | null;
    canSeeAllTenants: boolean;
  }) {
    const where: Prisma.UserWhereInput = {};
    if (opts.canSeeAllTenants) {
      if (opts.filterTenantId) where.tenantId = opts.filterTenantId;
    } else if (opts.actorTenantId) {
      where.tenantId = opts.actorTenantId;
    }
    const users = await this.prisma.user.findMany({
      where: {
        ...where,
        country: { not: null },
      },
      select: {
        country: true,
        countryCode: true,
        city: true,
      },
    });
    type Acc = { countryCode: string; cities: Map<string, number>; totalUsers: number };
    const byCountry = new Map<string, Acc>();
    for (const u of users) {
      const country = u.country ?? 'Unknown';
      const cc = u.countryCode ?? '';
      if (!byCountry.has(country)) {
        byCountry.set(country, { countryCode: cc, cities: new Map(), totalUsers: 0 });
      }
      const entry = byCountry.get(country)!;
      entry.totalUsers += 1;
      if (u.city) {
        entry.cities.set(u.city, (entry.cities.get(u.city) ?? 0) + 1);
      }
    }
    return [...byCountry.entries()].map(([country, v]) => ({
      country,
      countryCode: v.countryCode,
      totalUsers: v.totalUsers,
      cities: [...v.cities.entries()].map(([city, userCount]) => ({ city, userCount })),
    }));
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
        const b = t.branding;
        const hasBlob = b != null && CompanyService.storedLogoBytesLen(b.logoData) > 0;
        const url = b?.logoUrl ?? t.logoUrl;
        return hasBlob || (url != null && String(url).trim() !== '');
      })
      .map((t) => ({
        id: t.id,
        name: t.name,
        logoUrl: this.resolveDisplayLogoUrl(t.id, t.branding, t.logoUrl) ?? '',
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
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id },
      include: { branding: true, learningPaths: true },
    });
    const { branding, ...rest } = tenant;
    return {
      ...rest,
      branding: branding ? this.sanitizeBranding(tenant.id, branding) : null,
    };
  }

  async createTenant(name: string, slug: string) {
    return this.prisma.tenant.create({
      data: { name, slug },
    });
  }

  async updateTenant(
    id: string,
    data: {
      name?: string;
      slug?: string;
      settings?: Record<string, unknown>;
      logoUrl?: string | null;
      language?: string | null;
      status?: string | null;
      internalErp?: string | null;
      industryId?: string | null;
      linkedinProfileUrl?: string | null;
      targetMarkets?: string[];
      productsServices?: string[];
      certifications?: string[];
      staffingLevel?: string | null;
      companyProfileComplete?: boolean;
      tenantKind?: string;
      privateLabelConfig?: Record<string, unknown>;
      tenantApprovalStatus?: string;
    },
  ) {
    return this.prisma.tenant.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.settings !== undefined && {
          settings: data.settings as Prisma.InputJsonValue,
        }),
        ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl }),
        ...(data.language !== undefined && { language: data.language }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.internalErp !== undefined && { internalErp: data.internalErp }),
        ...(data.industryId !== undefined && { industryId: data.industryId }),
        ...(data.linkedinProfileUrl !== undefined && {
          linkedinProfileUrl: data.linkedinProfileUrl,
        }),
        ...(data.targetMarkets !== undefined && {
          targetMarkets: data.targetMarkets as Prisma.InputJsonValue,
        }),
        ...(data.productsServices !== undefined && {
          productsServices: data.productsServices as Prisma.InputJsonValue,
        }),
        ...(data.certifications !== undefined && {
          certifications: data.certifications as Prisma.InputJsonValue,
        }),
        ...(data.staffingLevel !== undefined && { staffingLevel: data.staffingLevel }),
        ...(data.companyProfileComplete !== undefined && {
          companyProfileComplete: data.companyProfileComplete,
        }),
        ...(data.tenantKind !== undefined && { tenantKind: data.tenantKind }),
        ...(data.privateLabelConfig !== undefined && {
          privateLabelConfig: data.privateLabelConfig as Prisma.InputJsonValue,
        }),
        ...(data.tenantApprovalStatus !== undefined && {
          tenantApprovalStatus: data.tenantApprovalStatus,
        }),
      },
      include: { branding: true },
    }).then((t) => ({
      ...t,
      branding: t.branding ? this.sanitizeBranding(t.id, t.branding) : null,
    }));
  }

  static isValidLinkedInCompanyUrl(url: string): boolean {
    return /^https?:\/\/(www\.)?linkedin\.com\/(in|company)\/[\w-]+\/?$/i.test(url.trim());
  }

  async deleteTenant(id: string) {
    return this.prisma.tenant.delete({ where: { id } });
  }

  async getBranding(tenantId: string) {
    const row = await this.prisma.tenantBranding.findUnique({
      where: { tenantId },
    });
    return row ? this.sanitizeBranding(tenantId, row) : null;
  }

  /** Public site theme: first tenant by name (same ordering as former admin-only list). */
  async getDefaultSiteBranding() {
    const tenant = await this.prisma.tenant.findFirst({
      orderBy: { name: 'asc' },
      select: { id: true },
    });
    if (!tenant) return null;
    return this.getBranding(tenant.id);
  }

  async upsertBranding(tenantId: string, data: BrandingDto) {
    const clearStoredLogo = data.clearStoredLogo === true;
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
    const row = await this.prisma.tenantBranding.upsert({
      where: { tenantId },
      create: {
        tenantId,
        ...brandingFields,
        settings: settingsStr,
      },
      update: {
        ...brandingFields,
        ...(settingsStr !== undefined && { settings: settingsStr }),
        ...(clearStoredLogo && { logoData: null, logoMimeType: null }),
      },
    });
    return this.sanitizeBranding(tenantId, row);
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
    const topLogoUrl = this.resolveDisplayLogoUrl(tenant.id, branding, tenant.logoUrl);
    return {
      id: tenant.id,
      name: branding?.appName || tenant.name,
      slug: tenant.slug,
      logoUrl: topLogoUrl,
      industry: tenant.industry?.name ?? null,
      branding: branding ? {
        primaryColor: branding.primaryColor,
        secondaryColor: branding.secondaryColor,
        accentColor: branding.accentColor,
        appName: branding.appName,
        tagline: branding.tagline,
        logoUrl: this.resolveDisplayLogoUrl(tenant.id, branding, tenant.logoUrl),
        faviconUrl: branding.faviconUrl,
        loginBgUrl: branding.loginBgUrl,
        fontFamily: branding.fontFamily,
        navStyle: branding.navStyle,
        customCss: branding.customCss,
        hasStoredLogo: CompanyService.storedLogoBytesLen(branding.logoData) > 0,
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
