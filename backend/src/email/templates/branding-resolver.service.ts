import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ResolvedEmailBranding } from './branding-types';

const DEFAULT_BASE = 'https://omnilearn.space';

@Injectable()
export class BrandingResolverService {
  private readonly db: any;

  constructor(private readonly prisma: PrismaService) {
    this.db = prisma as any;
  }

  /**
   * Resolves tenant-specific email branding with OmniLearn defaults when unscoped.
   */
  async resolveForTenant(
    tenantId: string | null,
    options?: { language?: string; baseUrl?: string },
  ): Promise<ResolvedEmailBranding> {
    const lang = options?.language || 'en';
    const baseUrl = (options?.baseUrl || process.env.PUBLIC_APP_URL || DEFAULT_BASE).replace(/\/$/, '');
    const rtl = lang === 'ar';

    if (!tenantId) {
      return this.omniLearnDefaults(baseUrl, rtl);
    }

    const [tenant, tenantBranding, emailBranding] = await Promise.all([
      this.db.tenant.findUnique({ where: { id: tenantId } }),
      this.db.tenantBranding.findUnique({ where: { tenantId } }),
      this.db.emailBranding.findUnique({ where: { tenantId } }),
    ]);

    const platformName =
      emailBranding?.senderName ||
      tenantBranding?.appName ||
      tenant?.name ||
      'OmniLearn';

    const logoUrl =
      emailBranding?.logoUrl ||
      tenantBranding?.emailLogoUrl ||
      tenantBranding?.logoUrl ||
      tenant?.logoUrl ||
      null;

    return {
      platformName,
      logoUrl,
      primaryColor: emailBranding?.primaryColor ?? tenantBranding?.primaryColor ?? '#6366F1',
      secondaryColor: emailBranding?.secondaryColor ?? tenantBranding?.secondaryColor ?? '#1E1B4B',
      accentColor: emailBranding?.accentColor ?? tenantBranding?.accentColor ?? '#F59E0B',
      textColor: emailBranding?.textColor ?? '#1F2937',
      backgroundColor: emailBranding?.backgroundColor ?? '#FFFFFF',
      surfaceColor: emailBranding?.surfaceColor ?? '#F9FAFB',
      borderRadius: emailBranding?.borderRadius ?? '8px',
      fontFamily: emailBranding?.fontFamily ?? tenantBranding?.fontFamily ?? 'Inter, system-ui, sans-serif',
      fontFamilyAr: emailBranding?.fontFamilyAr ?? 'Noto Sans Arabic, Segoe UI, Arial, sans-serif',
      buttonStyle: (emailBranding?.buttonStyle as Record<string, unknown>) ?? {
        borderRadius: '8px',
        padding: '12px 24px',
        fontWeight: '600',
      },
      senderName: emailBranding?.senderName ?? platformName,
      senderEmail: emailBranding?.senderEmail ?? 'noreply@omnilearn.space',
      replyToEmail: emailBranding?.replyToEmail ?? null,
      footerText: emailBranding?.footerText ?? null,
      footerLinks: Array.isArray(emailBranding?.footerLinks)
        ? (emailBranding.footerLinks as Array<{ label: string; url: string }>)
        : [],
      customCss: emailBranding?.customCss ?? tenantBranding?.customCss ?? null,
      baseUrl,
      rtl,
    };
  }

  private omniLearnDefaults(baseUrl: string, rtl: boolean): ResolvedEmailBranding {
    return {
      platformName: 'OmniLearn',
      logoUrl: null,
      primaryColor: '#6366F1',
      secondaryColor: '#1E1B4B',
      accentColor: '#F59E0B',
      textColor: '#1F2937',
      backgroundColor: '#FFFFFF',
      surfaceColor: '#F9FAFB',
      borderRadius: '8px',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontFamilyAr: 'Noto Sans Arabic, Segoe UI, Arial, sans-serif',
      buttonStyle: { borderRadius: '8px', padding: '12px 24px', fontWeight: '600' },
      senderName: 'OmniLearn',
      senderEmail: 'noreply@omnilearn.space',
      replyToEmail: null,
      footerText: null,
      footerLinks: [],
      customCss: null,
      baseUrl,
      rtl,
    };
  }
}
