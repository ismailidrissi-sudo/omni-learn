import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { GamificationService } from './gamification.service';

@Controller('gamification')
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Get('points/:userId')
  async getPoints(@Param('userId') userId: string) {
    return this.gamificationService.getPoints(userId);
  }

  @Post('points')
  async addPoints(@Body() body: { userId: string; points: number }) {
    return this.gamificationService.addPoints(body.userId, body.points);
  }

  @Get('streak/:userId')
  async getStreak(@Param('userId') userId: string) {
    return this.gamificationService.getStreak(userId);
  }

  @Get('badges/:userId')
  async getUserBadges(@Param('userId') userId: string) {
    return this.gamificationService.getUserBadges(userId);
  }

  @Post('badges/award')
  async awardBadge(@Body() body: { userId: string; badgeSlug: string }) {
    return this.gamificationService.awardBadge(body.userId, body.badgeSlug);
  }

  @Get('leaderboard')
  async getLeaderboard(@Query('limit') limit?: string) {
    return this.gamificationService.getLeaderboard(limit ? parseInt(limit, 10) : 10);
  }
}
