import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { DomainsService, CreateDomainDto, UpdateDomainDto } from './domains.service';

/**
 * Domains Controller — REST API for dynamic domains
 * omnilearn.space | Afflatus Consulting Group
 */

@Controller('domains')
export class DomainsController {
  constructor(private readonly domainsService: DomainsService) {}

  @Get()
  async list(
    @Query('tenantId') tenantId: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.domainsService.list(
      tenantId || undefined,
      activeOnly !== 'false',
    );
  }

  @Get('by-slug/:slug')
  async getBySlug(
    @Query('tenantId') tenantId: string,
    @Param('slug') slug: string,
  ) {
    if (!tenantId) {
      throw new Error('tenantId is required');
    }
    return this.domainsService.getBySlug(tenantId, slug);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.domainsService.getById(id);
  }

  @Post()
  async create(@Body() body: CreateDomainDto) {
    return this.domainsService.create(body);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: UpdateDomainDto) {
    return this.domainsService.update(id, body);
  }

  @Put(':id/toggle')
  async toggleActive(
    @Param('id') id: string,
    @Body() body: { active: boolean },
  ) {
    return this.domainsService.toggleActive(id, body.active);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.domainsService.delete(id);
  }
}
