import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DomainsService, CreateDomainDto, UpdateDomainDto } from './domains.service';
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';
import { RbacGuard } from '../auth/guards/rbac.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RbacRole } from '../constants/rbac.constant';

@Controller('domains')
export class DomainsController {
  constructor(private readonly domainsService: DomainsService) {}

  @Get()
  @UseGuards(OptionalJwtGuard)
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
  @UseGuards(OptionalJwtGuard)
  async getBySlug(
    @Query('tenantId') tenantId: string,
    @Param('slug') slug: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('tenantId is required');
    }
    return this.domainsService.getBySlug(tenantId, slug);
  }

  @Get(':id')
  @UseGuards(OptionalJwtGuard)
  async getById(@Param('id') id: string) {
    return this.domainsService.getById(id);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  async create(@Body() body: CreateDomainDto) {
    return this.domainsService.create(body);
  }

  @Put(':id')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  async update(@Param('id') id: string, @Body() body: UpdateDomainDto) {
    return this.domainsService.update(id, body);
  }

  @Put(':id/toggle')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  async toggleActive(
    @Param('id') id: string,
    @Body() body: { active: boolean },
  ) {
    return this.domainsService.toggleActive(id, body.active);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN)
  async delete(@Param('id') id: string) {
    return this.domainsService.delete(id);
  }
}
