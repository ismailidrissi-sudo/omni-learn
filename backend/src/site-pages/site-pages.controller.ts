import { Controller, Get, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SitePagesService, UpsertSitePageDto } from './site-pages.service';
import { RbacGuard } from '../auth/guards/rbac.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RbacRole } from '../constants/rbac.constant';

@Controller('site-pages')
export class SitePagesController {
  constructor(private readonly sitePages: SitePagesService) {}

  @Get()
  findAll() {
    return this.sitePages.findAll();
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.sitePages.findBySlug(slug);
  }

  @Put(':slug')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN)
  upsert(@Param('slug') slug: string, @Body() body: UpsertSitePageDto) {
    return this.sitePages.upsert(slug, body);
  }

  @Delete(':slug')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN)
  remove(@Param('slug') slug: string) {
    return this.sitePages.delete(slug);
  }
}
