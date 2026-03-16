import { Controller, Post, Get, Patch, Body, Param, Query, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProfileService } from './profile.service';
import { RbacGuard } from '../auth/guards/rbac.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RbacRole } from '../constants/rbac.constant';

/**
 * Profile Controller — User profile completion, tenant profile, trainer approval (admin)
 * omnilearn.space | Afflatus Consulting Group
 */

@Controller('profile')
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  /** Complete user profile (company, sector, department, position, LinkedIn) — requires auth */
  @Post('complete')
  @UseGuards(AuthGuard('jwt'))
  async completeProfile(
    @Req() req: { user?: { sub?: string } },
    @Body() body: {
      tenantId?: string;
      companyName?: string;
      companyLogoUrl?: string;
      industryId?: string;
      departmentId?: string;
      positionId?: string;
      linkedinProfileUrl?: string;
      sectorFocus?: string;
    },
  ) {
    const userId = req.user?.sub;
    if (!userId) throw new BadRequestException('Not authenticated');
    return this.profile.completeUserProfile(userId, body);
  }

  /** Get current user profile status */
  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async getMyProfile(@Req() req: { user?: { sub?: string } }) {
    const userId = req.user?.sub;
    if (!userId) throw new BadRequestException('Not authenticated');
    return this.profile.getUserProfile(userId);
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
    @Body() body: {
      industryId?: string;
      linkedinProfileUrl?: string;
      targetMarkets?: string[];
      productsServices?: string[];
      staffingLevel?: string;
    },
  ) {
    return this.profile.completeTenantProfile(tenantId, body);
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
  async getPendingTrainerRequests() {
    return this.profile.getPendingTrainerRequests();
  }

  /** Approve a user as trainer — grants content creation access (admin only) */
  @Patch('users/:userId/trainer-approve')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  async approveTrainer(@Param('userId') userId: string) {
    return this.profile.approveTrainer(userId);
  }

  /** Reject trainer request (admin only) */
  @Patch('users/:userId/trainer-reject')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  async rejectTrainer(@Param('userId') userId: string) {
    return this.profile.rejectTrainer(userId);
  }
}
