import { Controller, Post, Get, Body, Param, Query, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProfileService } from './profile.service';

/**
 * Profile Controller — User profile completion, tenant profile
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
}
