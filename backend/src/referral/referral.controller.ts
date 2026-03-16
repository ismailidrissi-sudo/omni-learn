import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, Req, BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RbacGuard } from '../auth/guards/rbac.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RbacRole } from '../constants/rbac.constant';
import { ReferralService } from './referral.service';
import { ReferralAnalyticsService } from './referral-analytics.service';
import {
  CreateReferralCodeDto,
  BulkInviteDto,
  GmailImportDto,
  LinkedInImportDto,
  GrantAccessRewardDto,
  ReferralAnalyticsQueryDto,
} from '../dto/referral.dto';

@Controller('referral')
export class ReferralController {
  constructor(
    private readonly referralService: ReferralService,
    private readonly analyticsService: ReferralAnalyticsService,
  ) {}

  // ── User endpoints ──

  @Get('dashboard')
  @UseGuards(AuthGuard('jwt'))
  async getDashboard(@Req() req: { user?: { sub?: string } }) {
    const userId = req.user?.sub;
    if (!userId) throw new BadRequestException('Not authenticated');
    return this.referralService.getUserDashboard(userId);
  }

  @Post('codes')
  @UseGuards(AuthGuard('jwt'))
  async createCode(@Req() req: { user?: { sub?: string } }, @Body() dto: CreateReferralCodeDto) {
    const userId = req.user?.sub;
    if (!userId) throw new BadRequestException('Not authenticated');
    return this.referralService.createCode(userId, dto.label);
  }

  @Get('codes')
  @UseGuards(AuthGuard('jwt'))
  async getCodes(@Req() req: { user?: { sub?: string } }) {
    const userId = req.user?.sub;
    if (!userId) throw new BadRequestException('Not authenticated');
    return this.referralService.getUserCodes(userId);
  }

  @Patch('codes/:id/deactivate')
  @UseGuards(AuthGuard('jwt'))
  async deactivateCode(@Req() req: { user?: { sub?: string } }, @Param('id') id: string) {
    const userId = req.user?.sub;
    if (!userId) throw new BadRequestException('Not authenticated');
    return this.referralService.deactivateCode(userId, id);
  }

  @Post('invite/bulk')
  @UseGuards(AuthGuard('jwt'))
  async bulkInvite(@Req() req: { user?: { sub?: string } }, @Body() dto: BulkInviteDto) {
    const userId = req.user?.sub;
    if (!userId) throw new BadRequestException('Not authenticated');
    return this.referralService.sendBulkInvitations(userId, dto.contacts, dto.referralCodeId);
  }

  @Post('import/gmail')
  @UseGuards(AuthGuard('jwt'))
  async importGmail(@Body() dto: GmailImportDto) {
    return this.referralService.importGmailContacts(dto.accessToken);
  }

  @Post('import/gmail/invite')
  @UseGuards(AuthGuard('jwt'))
  async importAndInviteGmail(
    @Req() req: { user?: { sub?: string } },
    @Body() body: GmailImportDto & { referralCodeId?: string },
  ) {
    const userId = req.user?.sub;
    if (!userId) throw new BadRequestException('Not authenticated');

    const contacts = await this.referralService.importGmailContacts(body.accessToken);
    if (contacts.length === 0) return { contacts: [], results: { sent: 0, skipped: 0, errors: 0 } };

    const results = await this.referralService.sendBulkInvitations(
      userId, contacts, body.referralCodeId,
    );
    return { contacts: contacts.length, results };
  }

  @Post('import/linkedin')
  @UseGuards(AuthGuard('jwt'))
  async importLinkedIn(@Body() dto: LinkedInImportDto) {
    return this.referralService.importLinkedInContacts(dto.accessToken);
  }

  @Post('import/linkedin/invite')
  @UseGuards(AuthGuard('jwt'))
  async importAndInviteLinkedIn(
    @Req() req: { user?: { sub?: string } },
    @Body() body: LinkedInImportDto & { referralCodeId?: string },
  ) {
    const userId = req.user?.sub;
    if (!userId) throw new BadRequestException('Not authenticated');

    const allContacts = await this.referralService.importLinkedInContacts(body.accessToken);
    const contactsWithEmail = allContacts.filter(
      (c): c is { email: string; name?: string; linkedinId?: string; profileUrl?: string } => !!c.email,
    );
    if (contactsWithEmail.length === 0) {
      return {
        totalImported: allContacts.length,
        withEmail: 0,
        withoutEmail: allContacts.length,
        results: { sent: 0, skipped: 0, errors: 0 },
      };
    }

    const results = await this.referralService.sendBulkInvitations(
      userId,
      contactsWithEmail.map((c) => ({ email: c.email, name: c.name })),
      body.referralCodeId,
    );

    return {
      totalImported: allContacts.length,
      withEmail: contactsWithEmail.length,
      withoutEmail: allContacts.length - contactsWithEmail.length,
      results,
    };
  }

  @Get('resolve/:code')
  async resolveCode(@Param('code') code: string) {
    const referralCode = await this.referralService.resolveCode(code);
    if (!referralCode) return { valid: false };
    return { valid: true, code: referralCode.code };
  }

  // ── Admin endpoints ──

  @Get('admin/overview')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.COMPANY_MANAGER)
  async getOverview(@Query() query: ReferralAnalyticsQueryDto) {
    return this.analyticsService.getOverview(
      query.tenantId,
      query.from ? new Date(query.from) : undefined,
      query.to ? new Date(query.to) : undefined,
    );
  }

  @Get('admin/top-referrers')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.COMPANY_MANAGER)
  async getTopReferrers(
    @Query('limit') limit?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.analyticsService.getTopReferrers(limit ? +limit : 20, tenantId);
  }

  @Get('admin/trends')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.COMPANY_MANAGER)
  async getTrends(@Query() query: ReferralAnalyticsQueryDto) {
    return this.analyticsService.getTrends(
      query.groupBy ?? 'day',
      query.from ? new Date(query.from) : undefined,
      query.to ? new Date(query.to) : undefined,
    );
  }

  @Get('admin/channels')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.COMPANY_MANAGER)
  async getChannelBreakdown(@Query() query: ReferralAnalyticsQueryDto) {
    return this.analyticsService.getChannelBreakdown(
      query.from ? new Date(query.from) : undefined,
      query.to ? new Date(query.to) : undefined,
    );
  }

  @Get('admin/rewards')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  async getRewardsSummary() {
    return this.analyticsService.getRewardsSummary();
  }

  @Get('admin/rewards/active')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  async getActiveRewards(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.analyticsService.getActiveRewards(page ? +page : 1, limit ? +limit : 50);
  }

  @Post('admin/grant-access')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  async grantAccess(@Body() dto: GrantAccessRewardDto) {
    return this.referralService.grantAccessReward(
      dto.userId, dto.plan, dto.durationMonths, dto.reason,
    );
  }

  @Post('admin/revoke-reward/:id')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  async revokeReward(@Param('id') id: string) {
    return this.referralService.revokeReward(id);
  }

  @Post('admin/expire-rewards')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN)
  async expireRewards() {
    return this.referralService.expireRewards();
  }
}
