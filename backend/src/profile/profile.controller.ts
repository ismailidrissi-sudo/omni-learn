import {
  Controller,
  Post,
  Get,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { ContentInteractionDto } from '../dto/content-interaction.dto';
import { AuthGuard } from '@nestjs/passport';
import { ProfileService } from './profile.service';
import { RbacGuard } from '../auth/guards/rbac.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RbacRole } from '../constants/rbac.constant';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUserPayload } from '../auth/types/request-user.types';

/**
 * Profile Controller — User profile completion, tenant profile, trainer approval (admin)
 * omnilearn.space | Afflatus Consulting Group
 */

@Controller('profile')
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  /** Request to join a branded academy (pending company-admin approval) */
  @Post('request-academy-join')
  @UseGuards(AuthGuard('jwt'))
  async requestAcademyJoin(
    @Req() req: { user?: { sub?: string } },
    @Body() body: { tenantId: string },
  ) {
    const userId = req.user?.sub;
    if (!userId) throw new BadRequestException('Not authenticated');
    return this.profile.requestAcademyJoin(userId, body.tenantId);
  }

  @Post('leave-academy')
  @UseGuards(AuthGuard('jwt'))
  async leaveAcademy(@Req() req: { user?: { sub?: string } }) {
    const userId = req.user?.sub;
    if (!userId) throw new BadRequestException('Not authenticated');
    return this.profile.leaveAcademy(userId);
  }

  /** Complete user profile (company, sector, department, position, LinkedIn, userType) — requires auth */
  @Post('complete')
  @UseGuards(AuthGuard('jwt'))
  async completeProfile(
    @Req() req: { user?: { sub?: string } },
    @Body() body: {
      tenantId?: string;
      joinCode?: string;
      companyName?: string;
      companyLogoUrl?: string;
      industryId?: string;
      departmentId?: string;
      positionId?: string;
      linkedinProfileUrl?: string;
      sectorFocus?: string;
      userType?: string;
    },
  ) {
    const userId = req.user?.sub;
    if (!userId) throw new BadRequestException('Not authenticated');
    return this.profile.completeUserProfile(userId, body);
  }

  /** Resolve a company join code to tenant name (public) */
  @Get('resolve-join-code/:code')
  async resolveJoinCode(@Param('code') code: string) {
    return this.profile.resolveJoinCode(code);
  }

  /** Get the referrer's company for the current user (auto-assignment on profile completion) */
  @Get('referral-company')
  @UseGuards(AuthGuard('jwt'))
  async getReferralCompany(@Req() req: { user?: { sub?: string } }) {
    const userId = req.user?.sub;
    if (!userId) throw new BadRequestException('Not authenticated');
    return this.profile.getReferralCompany(userId);
  }

  /** Get current user profile status */
  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async getMyProfile(@Req() req: { user?: { sub?: string } }) {
    const userId = req.user?.sub;
    if (!userId) throw new BadRequestException('Not authenticated');
    return this.profile.getUserProfile(userId);
  }

  /** Update demographics (gender, date of birth, country, city, phone) */
  @Patch('me')
  @UseGuards(AuthGuard('jwt'))
  async updateDemographics(
    @Req() req: { user?: { sub?: string } },
    @Body()
    body: {
      gender?: string;
      dateOfBirth?: string;
      country?: string;
      countryCode?: string;
      city?: string;
      timezone?: string;
      phoneNumber?: string;
    },
  ) {
    const userId = req.user?.sub;
    if (!userId) throw new BadRequestException('Not authenticated');
    return this.profile.updateDemographics(userId, body);
  }

  /** Get full user profile with enrollments, certificates, gamification */
  @Get('full')
  @UseGuards(AuthGuard('jwt'))
  async getFullProfile(@Req() req: { user?: { sub?: string } }) {
    const userId = req.user?.sub;
    if (!userId) throw new BadRequestException('Not authenticated');
    return this.profile.getFullUserProfile(userId);
  }

  /** Verify email with token (public) */
  @Get('verify-email')
  async verifyEmail(@Query('token') token: string) {
    if (!token) throw new BadRequestException('Token required');
    return this.profile.verifyEmail(token);
  }

  /** Complete tenant/company profile (admin) */
  @Post('tenant/:tenantId')
  @UseGuards(AuthGuard('jwt'))
  async completeTenantProfile(
    @Param('tenantId') tenantId: string,
    @Req() req: { user?: { sub?: string } },
    @Body() body: {
      industryId?: string;
      linkedinProfileUrl?: string;
      targetMarkets?: string[];
      productsServices?: string[];
      staffingLevel?: string;
    },
  ) {
    const userId = req.user?.sub;
    if (!userId) throw new BadRequestException('Not authenticated');
    return this.profile.completeTenantProfile(tenantId, userId, body);
  }

  /** List industries, departments, positions for profile forms */
  @Get('options')
  async getProfileOptions() {
    return this.profile.getProfileOptions();
  }

  /** Request trainer access — sets trainerRequested; admin must approve (authenticated user) */
  @Post('request-trainer')
  @UseGuards(AuthGuard('jwt'))
  async requestTrainerAccess(@Req() req: { user?: { sub?: string } }) {
    const userId = req.user?.sub;
    if (!userId) throw new BadRequestException('Not authenticated');
    return this.profile.requestTrainerAccess(userId);
  }

  /** List users pending trainer approval (admin only) */
  @Get('trainer-requests')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  async getPendingTrainerRequests(@CurrentUser() actor: RequestUserPayload) {
    return this.profile.getPendingTrainerRequests({
      isAdmin: actor.isAdmin,
      tenantId: actor.tenantId,
    });
  }

  /** Approve a user as trainer — grants content creation access (admin only) */
  @Patch('users/:userId/trainer-approve')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  async approveTrainer(@Param('userId') userId: string, @CurrentUser() actor: RequestUserPayload) {
    return this.profile.approveTrainer(userId, {
      isAdmin: actor.isAdmin,
      tenantId: actor.tenantId,
    });
  }

  /** Reject trainer request (admin only) */
  @Patch('users/:userId/trainer-reject')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  async rejectTrainer(@Param('userId') userId: string, @CurrentUser() actor: RequestUserPayload) {
    return this.profile.rejectTrainer(userId, {
      isAdmin: actor.isAdmin,
      tenantId: actor.tenantId,
    });
  }

  /** List pending org affiliation requests for a tenant (company admin / super admin) */
  @Get('org-affiliation-requests')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  async getPendingOrgAffiliations(
    @Query('tenantId') tenantId: string,
    @Req() req: { user?: { sub?: string } },
  ) {
    if (!tenantId) throw new BadRequestException('tenantId query parameter is required');
    const userId = req.user?.sub;
    if (!userId) throw new BadRequestException('Not authenticated');
    return this.profile.getPendingOrgAffiliations(tenantId, userId);
  }

  /** Approve a user's organization affiliation (company admin / super admin) */
  @Patch('users/:userId/org-approve')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  async approveOrgAffiliation(@Param('userId') userId: string, @Req() req: { user?: { sub?: string } }) {
    const actor = req.user?.sub;
    if (!actor) throw new BadRequestException('Not authenticated');
    return this.profile.approveOrgAffiliation(userId, actor);
  }

  /** Reject a user's organization affiliation (company admin / super admin) */
  @Patch('users/:userId/org-reject')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  async rejectOrgAffiliation(
    @Param('userId') userId: string,
    @Req() req: { user?: { sub?: string } },
    @Body() body?: { reason?: string },
  ) {
    const actor = req.user?.sub;
    if (!actor) throw new BadRequestException('Not authenticated');
    return this.profile.rejectOrgAffiliation(userId, actor, body?.reason);
  }

  /** List per-event email opt-in/out (transactional notifications like enrollments) */
  @Get('email-preferences')
  @UseGuards(AuthGuard('jwt'))
  async getEmailPreferences(@Req() req: { user?: { sub?: string } }) {
    const userId = req.user?.sub;
    if (!userId) throw new BadRequestException('Not authenticated');
    return this.profile.getEmailPreferences(userId);
  }

  @Put('email-preferences')
  @UseGuards(AuthGuard('jwt'))
  async putEmailPreference(
    @Req() req: { user?: { sub?: string } },
    @Body() body: { eventType: string; isEnabled: boolean },
  ) {
    const userId = req.user?.sub;
    if (!userId) throw new BadRequestException('Not authenticated');
    if (!body?.eventType) throw new BadRequestException('eventType required');
    return this.profile.upsertEmailPreference(userId, body.eventType, body.isEnabled !== false);
  }

  /** Record content view/preview/etc. (suggestion engine signals) */
  @Post('content-interactions')
  @UseGuards(AuthGuard('jwt'))
  async recordContentInteraction(@Req() req: { user?: { sub?: string } }, @Body() body: ContentInteractionDto) {
    const userId = req.user?.sub;
    if (!userId) throw new BadRequestException('Not authenticated');
    return this.profile.recordContentInteraction(userId, body);
  }

  /** List pending company admin requests (platform admin only) */
  @Get('company-admin-requests')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN)
  async getPendingCompanyAdminRequests() {
    return this.profile.getPendingCompanyAdminRequests();
  }

  /** Approve a user as company admin (platform admin only) */
  @Patch('users/:userId/company-admin-approve')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN)
  async approveCompanyAdmin(@Param('userId') userId: string) {
    return this.profile.approveCompanyAdmin(userId);
  }

  /** Reject company admin request (platform admin only) */
  @Patch('users/:userId/company-admin-reject')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN)
  async rejectCompanyAdmin(@Param('userId') userId: string) {
    return this.profile.rejectCompanyAdmin(userId);
  }
}
