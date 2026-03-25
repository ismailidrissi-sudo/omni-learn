import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RbacGuard } from '../auth/guards/rbac.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RbacRole } from '../constants/rbac.constant';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateEmailBrandingDto } from './dto/update-email-branding.dto';

function storedLogoByteLength(logoData: unknown): number {
  if (logoData == null) return 0;
  if (Buffer.isBuffer(logoData)) return logoData.length;
  if (logoData instanceof Uint8Array) return logoData.byteLength;
  return 0;
}

function defaultEmailBrandingResponse(tenantId: string) {
  return {
    id: null as string | null,
    tenantId,
    logoUrl: null as string | null,
    primaryColor: '#6366F1',
    secondaryColor: '#1E1B4B',
    accentColor: '#F59E0B',
    textColor: '#1F2937',
    backgroundColor: '#FFFFFF',
    surfaceColor: '#F9FAFB',
    borderRadius: '8px',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontFamilyAr: 'Noto Sans Arabic, Segoe UI, Arial, sans-serif',
    buttonStyle: {
      borderRadius: '8px',
      padding: '12px 24px',
      fontWeight: '600',
    } as Record<string, unknown>,
    senderName: 'OmniLearn',
    senderEmail: 'noreply@omnilearn.space',
    replyToEmail: null as string | null,
    footerText: null as string | null,
    footerLinks: [] as Array<{ label: string; url: string }>,
    customCss: null as string | null,
    isActive: true,
    isDefault: true,
  };
}

function mapRow(row: Record<string, unknown>, tenantId: string) {
  let footerLinks: Array<{ label: string; url: string }> = [];
  if (Array.isArray(row.footerLinks)) {
    footerLinks = row.footerLinks as Array<{ label: string; url: string }>;
  } else if (row.footerLinks && typeof row.footerLinks === 'object') {
    footerLinks = [];
  }

  let buttonStyle: Record<string, unknown> = {
    borderRadius: '8px',
    padding: '12px 24px',
    fontWeight: '600',
  };
  if (row.buttonStyle && typeof row.buttonStyle === 'object') {
    buttonStyle = row.buttonStyle as Record<string, unknown>;
  }

  return {
    id: row.id as string,
    tenantId: (row.tenantId as string) ?? tenantId,
    logoUrl: (row.logoUrl as string | null) ?? null,
    primaryColor: row.primaryColor as string,
    secondaryColor: row.secondaryColor as string,
    accentColor: row.accentColor as string,
    textColor: row.textColor as string,
    backgroundColor: row.backgroundColor as string,
    surfaceColor: row.surfaceColor as string,
    borderRadius: row.borderRadius as string,
    fontFamily: row.fontFamily as string,
    fontFamilyAr: row.fontFamilyAr as string,
    buttonStyle,
    senderName: row.senderName as string,
    senderEmail: row.senderEmail as string,
    replyToEmail: (row.replyToEmail as string | null) ?? null,
    footerText: (row.footerText as string | null) ?? null,
    footerLinks,
    customCss: (row.customCss as string | null) ?? null,
    isActive: row.isActive as boolean,
    isDefault: false,
  };
}

@Controller('company-admin/settings/email-branding')
@UseGuards(AuthGuard('jwt'), RbacGuard)
@Roles(RbacRole.COMPANY_ADMIN)
export class EmailBrandingController {
  private readonly db: any;

  constructor(private readonly prisma: PrismaService) {
    this.db = prisma as any;
  }

  private async requireTenantId(req: { user: { sub: string; tenantId?: string | null } }) {
    const u = await this.prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { tenantId: true, companyAdminApprovedAt: true },
    });
    if (!u?.tenantId) {
      throw new ForbiddenException('Company admin must belong to a tenant');
    }
    if (!u.companyAdminApprovedAt) {
      throw new ForbiddenException('Company admin is not approved');
    }
    if (req.user.tenantId != null && req.user.tenantId !== u.tenantId) {
      throw new ForbiddenException('Tenant mismatch');
    }
    return u.tenantId;
  }

  @Get()
  async get(@Req() req: { user: { sub: string; tenantId?: string | null } }) {
    const tenantId = await this.requireTenantId(req);
    const row = await this.db.emailBranding.findUnique({
      where: { tenantId },
    });
    if (!row) {
      return defaultEmailBrandingResponse(tenantId);
    }
    return mapRow(row, tenantId);
  }

  @Put()
  async upsert(
    @Body() body: UpdateEmailBrandingDto,
    @Req() req: { user: { sub: string; tenantId?: string | null } },
  ) {
    const tenantId = await this.requireTenantId(req);

    const data: Record<string, unknown> = {};
    const assign = <K extends keyof UpdateEmailBrandingDto>(key: K) => {
      if (body[key] !== undefined) data[key as string] = body[key];
    };

    assign('logoUrl');
    assign('primaryColor');
    assign('secondaryColor');
    assign('accentColor');
    assign('textColor');
    assign('backgroundColor');
    assign('surfaceColor');
    assign('fontFamily');
    assign('fontFamilyAr');
    assign('borderRadius');
    assign('buttonStyle');
    assign('senderName');
    assign('senderEmail');
    assign('replyToEmail');
    assign('footerText');
    assign('footerLinks');
    assign('customCss');
    assign('isActive');

    if (Object.keys(data).length === 0) {
      const existing = await this.db.emailBranding.findUnique({ where: { tenantId } });
      if (existing) return mapRow(existing, tenantId);
      return defaultEmailBrandingResponse(tenantId);
    }

    const row = await this.db.emailBranding.upsert({
      where: { tenantId },
      create: {
        tenantId,
        ...data,
      } as any,
      update: data as any,
    });

    return mapRow(row, tenantId);
  }

  @Post('match-web-app')
  async matchWebApp(@Req() req: { user: { sub: string; tenantId?: string | null } }) {
    const tenantId = await this.requireTenantId(req);

    const [tenantBranding, tenant] = await Promise.all([
      this.db.tenantBranding.findUnique({ where: { tenantId } }),
      this.db.tenant.findUnique({ where: { id: tenantId }, select: { name: true, logoUrl: true } }),
    ]);

    const apiBase = (process.env.PUBLIC_API_URL || process.env.PUBLIC_APP_URL || '').replace(/\/$/, '');
    const storedLogoUrl =
      tenantBranding && storedLogoByteLength(tenantBranding.logoData) > 0 && apiBase
        ? `${apiBase}/company/tenants/${tenantId}/logo`
        : null;

    const logoUrl =
      tenantBranding?.emailLogoUrl ?? storedLogoUrl ?? tenantBranding?.logoUrl ?? tenant?.logoUrl ?? null;

    const senderName = tenantBranding?.appName?.trim() || tenant?.name || 'OmniLearn';

    const data = {
      logoUrl,
      primaryColor: tenantBranding?.primaryColor ?? '#6366F1',
      secondaryColor: tenantBranding?.secondaryColor ?? '#1E1B4B',
      accentColor: tenantBranding?.accentColor ?? '#F59E0B',
      fontFamily: tenantBranding?.fontFamily ?? 'Inter, system-ui, sans-serif',
      customCss: tenantBranding?.customCss ?? null,
      senderName,
    };

    const row = await this.db.emailBranding.upsert({
      where: { tenantId },
      create: {
        tenantId,
        ...data,
      },
      update: data,
    });

    return mapRow(row, tenantId);
  }

  @Post('reset')
  async reset(@Req() req: { user: { sub: string; tenantId?: string | null } }) {
    const tenantId = await this.requireTenantId(req);
    await this.db.emailBranding.deleteMany({ where: { tenantId } });
    return defaultEmailBrandingResponse(tenantId);
  }
}
