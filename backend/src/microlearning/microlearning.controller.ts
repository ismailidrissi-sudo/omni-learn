import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MicrolearningService } from './microlearning.service';
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';

@Controller()
export class MicrolearningController {
  constructor(private readonly microlearning: MicrolearningService) {}

  @Get('users/:userId/assigned-content')
  @UseGuards(AuthGuard('jwt'))
  getAssignedContent(@Param('userId') userId: string) {
    return this.microlearning.getAssignedContent(userId);
  }

  @Get('microlearning/feed')
  @UseGuards(OptionalJwtGuard)
  getFeed(
    @Query('userId') userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.microlearning.getFeed(
      userId || 'anonymous',
      limit ? +limit : 20,
      offset ? +offset : 0,
    );
  }

  @Post('microlearning/:contentId/like')
  @UseGuards(AuthGuard('jwt'))
  toggleLike(
    @Param('contentId') contentId: string,
    @Body() body: { userId: string },
  ) {
    return this.microlearning.toggleLike(contentId, body.userId);
  }

  @Get('microlearning/:contentId/comments')
  @UseGuards(OptionalJwtGuard)
  getComments(
    @Param('contentId') contentId: string,
    @Query('limit') limit?: string,
  ) {
    return this.microlearning.getComments(contentId, limit ? +limit : 50);
  }

  @Post('microlearning/:contentId/comments')
  @UseGuards(AuthGuard('jwt'))
  addComment(
    @Param('contentId') contentId: string,
    @Body() body: { userId: string; body: string },
  ) {
    return this.microlearning.addComment(contentId, body.userId, body.body);
  }

  @Post('microlearning/:contentId/share')
  @UseGuards(AuthGuard('jwt'))
  recordShare(
    @Param('contentId') contentId: string,
    @Body() body: { userId: string },
  ) {
    return this.microlearning.recordShare(contentId, body.userId);
  }
}
