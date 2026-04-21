import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
  BadRequestException,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsString, IsInt, IsOptional, IsIn } from 'class-validator';
import { GamificationService } from './gamification.service';
import { POINT_REASONS, PointReason } from './gamification.rules';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RbacGuard } from '../auth/guards/rbac.guard';
import { RbacRole } from '../constants/rbac.constant';
import type { RequestUserPayload } from '../auth/types/request-user.types';

class AdminGrantPointsDto {
  @IsString() userId!: string;
  @IsIn(Object.values(POINT_REASONS)) reason!: PointReason;
  @IsOptional() @IsInt() overrideDelta?: number;
  @IsString() idempotencyKey!: string;
  @IsOptional() @IsString() sourceType?: string;
  @IsOptional() @IsString() sourceId?: string;
}

class AwardBadgeDto {
  @IsString() badgeSlug!: string;
  @IsOptional() @IsString() userId?: string; // admin only
}

@Controller('gamification')
@UseGuards(AuthGuard('jwt'))
export class GamificationController {
  constructor(private readonly gamification: GamificationService) {}

  @Get('points/:userId')
  async getPoints(
    @Param('userId') userId: string,
    @CurrentUser() user: RequestUserPayload,
  ) {
    this.assertSelfOrElevated(user, userId);
    return { points: await this.gamification.getPoints(userId) };
  }

  @Get('streak/:userId')
  async getStreak(
    @Param('userId') userId: string,
    @CurrentUser() user: RequestUserPayload,
  ) {
    this.assertSelfOrElevated(user, userId);
    return this.gamification.getStreak(userId);
  }

  @Get('badges/:userId')
  async getBadges(
    @Param('userId') userId: string,
    @CurrentUser() user: RequestUserPayload,
  ) {
    this.assertSelfOrElevated(user, userId);
    return this.gamification.getBadges(userId);
  }

  @Post('points')
  @UseGuards(RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN)
  async adminGrantPoints(
    @Body() dto: AdminGrantPointsDto,
    @CurrentUser() user: RequestUserPayload,
  ) {
    if (
      dto.reason !== POINT_REASONS.ADMIN_GRANT &&
      dto.reason !== POINT_REASONS.ADMIN_REVOKE
    ) {
      throw new BadRequestException(
        'Manual endpoint accepts only admin_grant or admin_revoke',
      );
    }
    if (!user.tenantId) {
      throw new BadRequestException('Tenant context required for manual points');
    }
    return this.gamification.grantPoints({
      userId: dto.userId,
      tenantId: user.tenantId,
      reason: dto.reason,
      overrideDelta: dto.overrideDelta,
      idempotencyKey: dto.idempotencyKey,
      sourceType: dto.sourceType,
      sourceId: dto.sourceId,
    });
  }

  @Post('badges/award')
  async awardBadge(
    @Body() dto: AwardBadgeDto,
    @CurrentUser() user: RequestUserPayload,
  ) {
    const targetUserId = dto.userId ?? user.sub;
    if (targetUserId !== user.sub && !this.isGamificationAdmin(user)) {
      throw new ForbiddenException('Cannot award badges to other users');
    }
    return this.gamification.awardBadge(targetUserId, dto.badgeSlug);
  }

  @Get('leaderboard')
  async getLeaderboard(
    @CurrentUser() user: RequestUserPayload,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    if (!user.tenantId) {
      throw new BadRequestException('Tenant context required for leaderboard');
    }
    return this.gamification.getLeaderboard(user.tenantId, limit);
  }

  private assertSelfOrElevated(
    user: RequestUserPayload,
    targetUserId: string,
  ) {
    if (user.sub !== targetUserId && !this.isGamificationAdmin(user)) {
      throw new ForbiddenException();
    }
  }

  private isGamificationAdmin(user: RequestUserPayload): boolean {
    return (
      user.isAdmin ||
      user.roles.includes(RbacRole.SUPER_ADMIN) ||
      user.roles.includes(RbacRole.COMPANY_ADMIN) ||
      user.roles.includes(RbacRole.COMPANY_MANAGER)
    );
  }
}
