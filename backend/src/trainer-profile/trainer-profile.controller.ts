import {
  Controller,
  Get,
  Put,
  Patch,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { TrainerProfileService } from './trainer-profile.service';
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';
import { UpsertTrainerProfileDto, PublishTrainerProfileDto } from '../dto/trainer-profile.dto';

@Controller('trainer-profiles')
export class TrainerProfileController {
  constructor(private readonly service: TrainerProfileService) {}

  @Get('me/stats')
  @UseGuards(AuthGuard('jwt'))
  async getMyStats(@Req() req: { user?: { sub?: string } }) {
    const userId = req.user?.sub;
    if (!userId) throw new BadRequestException('Not authenticated');
    return this.service.getMyStats(userId);
  }

  @Get('me/reviews')
  @UseGuards(AuthGuard('jwt'))
  async getMyReviews(
    @Req() req: { user?: { sub?: string } },
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const userId = req.user?.sub;
    if (!userId) throw new BadRequestException('Not authenticated');
    return this.service.getMyReviews(
      userId,
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Post('me/photo')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: 5_000_000 } }))
  async uploadPhoto(
    @Req() req: { user?: { sub?: string } },
    @UploadedFile() file: { buffer: Buffer; mimetype: string; originalname: string; size: number } | undefined,
  ) {
    const userId = req.user?.sub;
    if (!userId) throw new BadRequestException('Not authenticated');
    if (!file?.buffer?.length) throw new BadRequestException('No file provided');
    const url = await this.service.saveAvatarFile(file.buffer, file.mimetype);
    await this.service.upsert(userId, { photoUrl: url });
    return { photoUrl: url };
  }

  @Get('avatar-files/:filename')
  async serveAvatar(@Param('filename') filename: string, @Res({ passthrough: true }) res: Response) {
    const result = this.service.getAvatarFileBuffer(filename);
    if (!result) throw new BadRequestException('File not found');
    res.setHeader('Content-Type', result.mime);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return new StreamableFile(result.buffer);
  }

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

  @Get(':slug/reviews')
  @UseGuards(OptionalJwtGuard)
  async getPublicReviews(
    @Param('slug') slug: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.getPublicReviews(
      slug,
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get(':slug')
  @UseGuards(OptionalJwtGuard)
  async getPublicProfile(@Param('slug') slug: string) {
    return this.service.getPublicProfile(slug);
  }
}
