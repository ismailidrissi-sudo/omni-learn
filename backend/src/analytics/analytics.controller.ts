import { Controller, Get, Post, Body, Param, Query, UseGuards, Req, Res, Headers } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response, Request } from 'express';
import { AnalyticsService } from './analytics.service';
import { SessionTrackingService } from './session-tracking.service';
import { DeepAnalyticsService } from './deep-analytics.service';
import { CsvExportService } from './csv-export.service';
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';
import { RbacGuard } from '../auth/guards/rbac.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RbacRole } from '../constants/rbac.constant';
import { AnalyticsFiltersDto } from './dto/analytics-filters.dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly sessions: SessionTrackingService,
    private readonly deep: DeepAnalyticsService,
    private readonly csv: CsvExportService,
  ) {}

  // ── Legacy endpoints ──

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

  // ── Session tracking ──

  @Post('session/start')
  @UseGuards(AuthGuard('jwt'))
  startSession(
    @Req() req: Request,
    @Body() body: { fingerprint?: string; screenResolution?: string; language?: string; tenantId?: string },
  ) {
    const userId = (req as any).user?.sub;
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;
    const ua = req.headers['user-agent'];
    return this.sessions.startSession(userId, ip, ua, body);
  }

  @Post('session/heartbeat')
  @UseGuards(AuthGuard('jwt'))
  heartbeat(@Req() req: Request, @Body() body: { sessionId: string }) {
    const userId = (req as any).user?.sub;
    return this.sessions.heartbeat(body.sessionId, userId);
  }

  @Post('session/end')
  @UseGuards(OptionalJwtGuard)
  endSession(@Req() req: Request, @Body() body: { sessionId: string; userId?: string }) {
    const userId = (req as any).user?.sub || body.userId;
    return this.sessions.endSession(body.sessionId, userId);
  }

  @Post('session/pageview')
  @UseGuards(AuthGuard('jwt'))
  recordPageView(
    @Req() req: Request,
    @Body() body: { sessionId: string; path: string; title?: string; contentId?: string; contentType?: string; durationSeconds?: number },
  ) {
    const userId = (req as any).user?.sub;
    return this.sessions.recordPageView(body.sessionId, userId, body);
  }

  // ── Deep analytics ──

  @Get('deep/overview')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.COMPANY_MANAGER)
  deepOverview(@Query() filters: AnalyticsFiltersDto) {
    return this.deep.getDashboardOverview(filters);
  }

  @Get('deep/users')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.COMPANY_MANAGER)
  deepUsers(@Query() filters: AnalyticsFiltersDto) {
    return this.deep.getUsersList(filters);
  }

  @Get('deep/content')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.COMPANY_MANAGER)
  deepContent(@Query() filters: AnalyticsFiltersDto) {
    return this.deep.getContentList(filters);
  }

  @Get('deep/devices')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.COMPANY_MANAGER)
  deepDevices(@Query() filters: AnalyticsFiltersDto) {
    return this.deep.getDeviceBreakdown(filters);
  }

  @Get('deep/geo')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.COMPANY_MANAGER)
  deepGeo(@Query() filters: AnalyticsFiltersDto) {
    return this.deep.getGeographicData(filters);
  }

  @Get('deep/timeline')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.COMPANY_MANAGER)
  deepTimeline(@Query() filters: AnalyticsFiltersDto) {
    return this.deep.getSessionTimeline(filters);
  }

  @Get('deep/heatmap')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.COMPANY_MANAGER)
  deepHeatmap(@Query() filters: AnalyticsFiltersDto) {
    return this.deep.getUserActivityHeatmap(filters);
  }

  @Get('deep/demographics')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.COMPANY_MANAGER)
  deepDemographics(@Query() filters: AnalyticsFiltersDto) {
    return this.deep.getDemographicsBreakdown(filters);
  }

  @Get('deep/funnel')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.COMPANY_MANAGER)
  deepFunnel(@Query() filters: AnalyticsFiltersDto) {
    return this.deep.getCompletionFunnel(filters);
  }

  @Get('deep/velocity')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.COMPANY_MANAGER)
  deepVelocity(@Query() filters: AnalyticsFiltersDto) {
    return this.deep.getLearningVelocity(filters);
  }

  @Get('deep/retention')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.COMPANY_MANAGER)
  deepRetention(@Query() filters: AnalyticsFiltersDto) {
    return this.deep.getRetentionCohorts(filters);
  }

  @Get('deep/content/:courseId/dropoff')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.COMPANY_MANAGER, RbacRole.INSTRUCTOR)
  deepDropoff(@Param('courseId') courseId: string) {
    return this.deep.getContentDropoff(courseId);
  }

  @Get('deep/browsers')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.COMPANY_MANAGER)
  deepBrowsers(@Query() filters: AnalyticsFiltersDto) {
    return this.deep.getBrowserOSBreakdown(filters);
  }

  @Get('deep/top-content')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.COMPANY_MANAGER)
  deepTopContent(@Query() filters: AnalyticsFiltersDto, @Query('limit') limit?: string) {
    return this.deep.getTopContent(filters, limit ? +limit : 10);
  }

  // ── CSV exports ──

  @Get('deep/export/users')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  async exportUsers(@Query() filters: AnalyticsFiltersDto, @Res() res: Response) {
    const csvData = await this.csv.exportUsers(filters);
    this.sendCsv(res, csvData, 'users');
  }

  @Get('deep/export/content')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  async exportContent(@Query() filters: AnalyticsFiltersDto, @Res() res: Response) {
    const csvData = await this.csv.exportContent(filters);
    this.sendCsv(res, csvData, 'content');
  }

  @Get('deep/export/sessions')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  async exportSessions(@Query() filters: AnalyticsFiltersDto, @Res() res: Response) {
    const csvData = await this.csv.exportSessions(filters);
    this.sendCsv(res, csvData, 'sessions');
  }

  @Get('deep/export/geo')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  async exportGeo(@Query() filters: AnalyticsFiltersDto, @Res() res: Response) {
    const csvData = await this.csv.exportGeo(filters);
    this.sendCsv(res, csvData, 'geography');
  }

  @Get('deep/export/geo.xlsx')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  async exportGeoXlsx(@Query() filters: AnalyticsFiltersDto, @Res() res: Response) {
    const buf = await this.csv.buildGeoExcelBuffer(filters);
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="omnilearn-geo-${date}.xlsx"`);
    res.send(buf);
  }

  @Get('deep/export/geo.pdf')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  async exportGeoPdf(@Query() filters: AnalyticsFiltersDto, @Res() res: Response) {
    const buf = await this.csv.buildGeoPdfBuffer(filters);
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="omnilearn-geo-${date}.pdf"`);
    res.send(buf);
  }

  @Get('deep/export/demographics')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  async exportDemographics(@Query() filters: AnalyticsFiltersDto, @Res() res: Response) {
    const csvData = await this.csv.exportDemographics(filters);
    this.sendCsv(res, csvData, 'demographics');
  }

  @Get('deep/export/full')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  async exportFull(@Query() filters: AnalyticsFiltersDto, @Res() res: Response) {
    const csvData = await this.csv.exportFull(filters);
    this.sendCsv(res, csvData, 'full-export');
  }

  private sendCsv(res: Response, data: string, name: string) {
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="omnilearn-${name}-${date}.csv"`);
    res.send('\uFEFF' + data); // BOM for Excel UTF-8
  }
}
