import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { VideoService } from './video.service';
import { ResolveVideoDto } from './dto/resolve-video.dto';
import { UpdateProgressDto } from './dto/update-progress.dto';
import axios from 'axios';

@Controller('video')
export class VideoController {
  private readonly logger = new Logger(VideoController.name);

  constructor(private readonly videoService: VideoService) {}

  @Post('resolve')
  @UseGuards(AuthGuard('jwt'))
  async resolveVideo(@Body() dto: ResolveVideoDto) {
    try {
      return await this.videoService.resolveVideo(dto.url, dto.preferredQuality);
    } catch (err: any) {
      const message =
        err?.response?.data?.detail ||
        'Failed to resolve video. It may be private, restricted, or unavailable.';
      throw new HttpException(message, HttpStatus.BAD_GATEWAY);
    }
  }

  @Get('stream/:videoId')
  async streamVideo(
    @Param('videoId') videoId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    let streamUrl: string;
    try {
      streamUrl = await this.videoService.getStreamUrl(videoId);
    } catch {
      throw new HttpException('Video not available', HttpStatus.NOT_FOUND);
    }

    const headers: Record<string, string> = {};
    const rangeHeader = req.headers.range;
    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }

    try {
      const upstream = await axios.get(streamUrl, {
        headers,
        responseType: 'stream',
        timeout: 30000,
      });

      res.status(upstream.status);
      res.set({
        'Content-Type': upstream.headers['content-type'] || 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=3600',
        ...(upstream.headers['content-length']
          ? { 'Content-Length': upstream.headers['content-length'] }
          : {}),
        ...(upstream.headers['content-range']
          ? { 'Content-Range': upstream.headers['content-range'] }
          : {}),
      });

      upstream.data.pipe(res);
    } catch (err: any) {
      this.logger.error(`Stream proxy failed for ${videoId}: ${err.message}`);
      throw new HttpException('Stream unavailable', HttpStatus.BAD_GATEWAY);
    }
  }

  @Get('thumbnail/:videoId')
  async getThumbnail(
    @Param('videoId') videoId: string,
    @Res() res: Response,
  ) {
    let thumbnailUrl: string;
    try {
      thumbnailUrl = await this.videoService.getThumbnailUrl(videoId);
    } catch {
      throw new HttpException('Thumbnail not available', HttpStatus.NOT_FOUND);
    }

    if (!thumbnailUrl) {
      throw new HttpException('No thumbnail', HttpStatus.NOT_FOUND);
    }

    try {
      const upstream = await axios.get(thumbnailUrl, {
        responseType: 'stream',
        timeout: 10000,
      });

      res.set({
        'Content-Type': upstream.headers['content-type'] || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
      });

      upstream.data.pipe(res);
    } catch {
      throw new HttpException('Thumbnail fetch failed', HttpStatus.BAD_GATEWAY);
    }
  }

  @Post('progress')
  @UseGuards(AuthGuard('jwt'))
  async updateProgress(@Body() dto: UpdateProgressDto) {
    const result = await this.videoService.upsertProgress(dto);

    if (dto.isCompleted) {
      await this.videoService.syncCompletionToCourseProgress(
        dto.userId,
        dto.contentId,
      );
    }

    return { status: 'ok', id: result.id };
  }

  @Get('progress/:contentId')
  @UseGuards(AuthGuard('jwt'))
  async getProgress(
    @Param('contentId') contentId: string,
    @Query('userId') userId: string,
  ) {
    return this.videoService.getProgress(userId, contentId);
  }

  @Get('analytics/course/:courseId')
  @UseGuards(AuthGuard('jwt'))
  async getCourseAnalytics(@Param('courseId') courseId: string) {
    return this.videoService.getCourseVideoAnalytics(courseId);
  }
}
