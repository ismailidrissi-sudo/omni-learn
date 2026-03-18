import { Controller, Get, Put, Patch, Body, Param, Query, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TrainerProfileService } from './trainer-profile.service';
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';
import { UpsertTrainerProfileDto, PublishTrainerProfileDto } from '../dto/trainer-profile.dto';

@Controller('trainer-profiles')
export class TrainerProfileController {
  constructor(private readonly service: TrainerProfileService) {}

  @Put('me')
  @UseGuards(AuthGuard('jwt'))
  async upsertMyProfile(
    @Req() req: { user?: { sub?: string } },
    @Body() dto: UpsertTrainerProfileDto,
  ) {
    const userId = req.user?.sub;
    if (!userId) throw new BadRequestException('Not authenticated');
    return this.service.upsert(userId, dto);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async getMyProfile(@Req() req: { user?: { sub?: string } }) {
    const userId = req.user?.sub;
    if (!userId) throw new BadRequestException('Not authenticated');
    return this.service.getMyProfile(userId);
  }

  @Patch('me/status')
  @UseGuards(AuthGuard('jwt'))
  async setStatus(
    @Req() req: { user?: { sub?: string } },
    @Body() dto: PublishTrainerProfileDto,
  ) {
    const userId = req.user?.sub;
    if (!userId) throw new BadRequestException('Not authenticated');
    return this.service.setStatus(userId, dto.status);
  }

  @Patch('me/refresh-stats')
  @UseGuards(AuthGuard('jwt'))
  async refreshStats(@Req() req: { user?: { sub?: string } }) {
    const userId = req.user?.sub;
    if (!userId) throw new BadRequestException('Not authenticated');
    return this.service.refreshStats(userId);
  }

  @Get('directory')
  @UseGuards(OptionalJwtGuard)
  async listPublic(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.service.listPublicProfiles(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      search,
    );
  }

  @Get(':slug')
  @UseGuards(OptionalJwtGuard)
  async getPublicProfile(@Param('slug') slug: string) {
    return this.service.getPublicProfile(slug);
  }
}
