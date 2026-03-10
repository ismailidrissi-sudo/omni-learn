import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { CompanyService, BrandingDto } from './company.service';

@Controller('company')
export class CompanyController {
  constructor(private readonly company: CompanyService) {}

  @Get('tenants')
  listTenants() {
    return this.company.listTenants();
  }

  @Get('users')
  listUsers(@Query('tenantId') tenantId?: string) {
    return this.company.listUsers(tenantId);
  }

  @Get('trusted-by')
  getTrustedBy() {
    return this.company.getTrustedBy();
  }

  @Get('tenants/:id')
  getTenant(@Param('id') id: string) {
    return this.company.getTenant(id);
  }

  @Post('tenants')
  createTenant(@Body() body: { name: string; slug: string }) {
    return this.company.createTenant(body.name, body.slug);
  }

  @Put('tenants/:id')
  updateTenant(@Param('id') id: string, @Body() body: { name?: string; slug?: string; settings?: string }) {
    return this.company.updateTenant(id, body);
  }

  @Get('tenants/:tenantId/branding')
  getBranding(@Param('tenantId') tenantId: string) {
    return this.company.getBranding(tenantId);
  }

  @Put('tenants/:tenantId/branding')
  upsertBranding(@Param('tenantId') tenantId: string, @Body() body: BrandingDto) {
    return this.company.upsertBranding(tenantId, body);
  }
}
