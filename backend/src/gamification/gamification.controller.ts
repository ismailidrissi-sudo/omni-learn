import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GamificationService } from './gamification.service';
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';

@Controller('gamification')
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Get('points/:userId')
  @UseGuards(AuthGuard('jwt'))
  async getPoints(@Param('userId') userId: string) {
    return this.gamificationService.getPoints(userId);
  }

  @Post('points')
  @UseGuards(AuthGuard('jwt'))
  async addPoints(@Body() body: { userId: string; points: number }) {
    return this.gamificationService.addPoints(body.userId, body.points);
  }

  @Get('streak/:userId')
  @UseGuards(AuthGuard('jwt'))
  async getStreak(@Param('userId') userId: string) {
    return this.gamificationService.getStreak(userId);
  }

  @Get('badges/:userId')
  @UseGuards(AuthGuard('jwt'))
  async getUserBadges(@Param('userId') userId: string) {
    return this.gamificationService.getUserBadges(userId);
  }

  @Post('badges/award')
  @UseGuards(AuthGuard('jwt'))
  async awardBadge(@Body() body: { userId: string; badgeSlug: string }) {
    return this.gamificationService.awardBadge(body.userId, body.badgeSlug);
  }

  @Get('leaderboard')
  @UseGuards(OptionalJwtGuard)
  async getLeaderboard(@Query('limit') limit?: string) {
    return this.gamificationService.getLeaderboard(limit ? parseInt(limit, 10) : 10);
  }
}
