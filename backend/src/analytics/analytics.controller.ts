import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post('track')
  track(@Body() body: { eventType: string; payload?: Record<string, unknown> }) {
    return this.analytics.track(body.eventType, body.payload ?? {});
  }

  @Get('overview')
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
  getPathAnalytics(@Param('pathId') pathId: string) {
    return this.analytics.getPathAnalytics(pathId);
  }

  @Get('events')
  getRecentEvents(
    @Query('tenantId') tenantId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.analytics.getRecentEvents(tenantId, limit ? +limit : 50);
  }
}
