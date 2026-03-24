import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, NotFoundException, BadRequestException } from '@nestjs/common';
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
  updateTenant(@Param('id') id: string, @Body() body: { name?: string; slug?: string; settings?: Record<string, unknown> }) {
    return this.company.updateTenant(id, body);
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
