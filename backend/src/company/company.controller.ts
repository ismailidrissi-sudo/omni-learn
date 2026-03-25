import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  NotFoundException,
  BadRequestException,
  StreamableFile,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { CompanyService, BrandingDto, EnterpriseLeadDto } from './company.service';
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';
import { RbacGuard } from '../auth/guards/rbac.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RbacRole } from '../constants/rbac.constant';

@Controller('company')
export class CompanyController {
  constructor(private readonly company: CompanyService) {}

  @Get('tenants/by-slug/:slug/portal')
  async getTenantPortal(@Param('slug') slug: string) {
    const portal = await this.company.getTenantPortal(slug);
    if (!portal) throw new NotFoundException('Academy not found');
    return portal;
  }

  /** Default tenant branding for marketing / app shell (no auth). */
  @Get('default-branding')
  getDefaultBranding() {
    return this.company.getDefaultSiteBranding();
  }

  @Get('tenants')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN)
  listTenants() {
    return this.company.listTenants();
  }

  @Get('users')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.COMPANY_MANAGER)
  listUsers(@Query('tenantId') tenantId?: string) {
    return this.company.listUsers(tenantId);
  }

  @Get('trusted-by')
  getTrustedBy() {
    return this.company.getTrustedBy();
  }

  @Get('stats')
  @UseGuards(OptionalJwtGuard)
  getPlatformStats() {
    return this.company.getPlatformStats();
  }

  /** Public: binary academy logo stored in TenantBranding.logoData */
  @Get('tenants/:tenantId/logo')
  async getTenantLogo(
    @Param('tenantId') tenantId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.company.getTenantLogoFile(tenantId);
    if (!file) throw new NotFoundException('Logo not found');
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return new StreamableFile(file.buffer);
  }

  @Post('tenants/:tenantId/branding/logo')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  @UseInterceptors(FileInterceptor('logo', { limits: { fileSize: 1_500_000 } }))
  async uploadTenantLogo(
    @Param('tenantId') tenantId: string,
    @UploadedFile()
    file: { buffer: Buffer; mimetype: string; size: number } | undefined,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('Empty logo file');
    if (file.size > 1_500_000) throw new BadRequestException('Logo must be at most 1.5 MB');
    if (!/^(image\/png|image\/jpeg|image\/webp|image\/gif|image\/svg\+xml)$/.test(file.mimetype)) {
      throw new BadRequestException('Logo must be PNG, JPEG, WebP, GIF, or SVG');
    }
    await this.company.saveTenantLogoBytes(tenantId, file.buffer, file.mimetype);
    return this.company.getBranding(tenantId);
  }

  @Delete('tenants/:tenantId/branding/logo')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  async deleteTenantLogo(@Param('tenantId') tenantId: string) {
    await this.company.clearTenantLogoBytes(tenantId);
    return this.company.getBranding(tenantId);
  }

  @Get('tenants/:id')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  getTenant(@Param('id') id: string) {
    return this.company.getTenant(id);
  }

  @Post('tenants')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN)
  createTenant(@Body() body: { name: string; slug: string }) {
    if (this.company.isReservedSlug(body.slug)) {
      throw new BadRequestException(`The slug "${body.slug}" is reserved and cannot be used`);
    }
    return this.company.createTenant(body.name, body.slug);
  }

  @Put('tenants/:id')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  updateTenant(
    @Param('id') id: string,
    @Body()
    body: {
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
    },
  ) {
    if (body.slug != null && this.company.isReservedSlug(body.slug)) {
      throw new BadRequestException(`The slug "${body.slug}" is reserved and cannot be used`);
    }

    const payload = { ...body };
    if (payload.industryId === '') payload.industryId = null;
    if (payload.logoUrl === '') payload.logoUrl = null;
    if (payload.internalErp === '') payload.internalErp = null;
    if (payload.language === '') payload.language = null;
    if (payload.staffingLevel === '') payload.staffingLevel = null;
    if (payload.status === '') payload.status = null;

    if (body.linkedinProfileUrl !== undefined) {
      const li = String(body.linkedinProfileUrl).trim();
      if (li === '') {
        payload.linkedinProfileUrl = null;
      } else if (!CompanyService.isValidLinkedInCompanyUrl(li)) {
        throw new BadRequestException('Invalid LinkedIn company URL');
      } else {
        payload.linkedinProfileUrl = li;
      }
    }

    return this.company.updateTenant(id, payload);
  }

  @Delete('tenants/:id')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN)
  deleteTenant(@Param('id') id: string) {
    return this.company.deleteTenant(id);
  }

  @Get('tenants/:tenantId/branding')
  @UseGuards(OptionalJwtGuard)
  getBranding(@Param('tenantId') tenantId: string) {
    return this.company.getBranding(tenantId);
  }

  @Put('tenants/:tenantId/branding')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  upsertBranding(@Param('tenantId') tenantId: string, @Body() body: BrandingDto) {
    return this.company.upsertBranding(tenantId, body);
  }

  @Post('leads')
  createLead(@Body() body: EnterpriseLeadDto) {
    return this.company.createEnterpriseLead(body);
  }

  @Get('tenants/:tenantId/analytics')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.COMPANY_MANAGER)
  getEmployeeAnalytics(@Param('tenantId') tenantId: string) {
    return this.company.getEmployeeAnalytics(tenantId);
  }
}
