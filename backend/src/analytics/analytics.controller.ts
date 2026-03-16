import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AnalyticsService } from './analytics.service';
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';
import { RbacGuard } from '../auth/guards/rbac.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RbacRole } from '../constants/rbac.constant';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post('track')
  @UseGuards(OptionalJwtGuard)
  track(@Body() body: { eventType: string; payload?: Record<string, unknown> }) {
    return this.analytics.track(body.eventType, body.payload ?? {});
  }

  @Get('overview')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.COMPANY_MANAGER)
  getOverview(
    @Query('tenantId') tenantId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analytics.getOverview(
      tenantId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @Get('paths/:pathId')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.COMPANY_MANAGER, RbacRole.INSTRUCTOR)
  getPathAnalytics(@Param('pathId') pathId: string) {
    return this.analytics.getPathAnalytics(pathId);
  }

  @Get('events')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.COMPANY_MANAGER)
  getRecentEvents(
    @Query('tenantId') tenantId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.analytics.getRecentEvents(tenantId, limit ? +limit : 50);
  }
}
