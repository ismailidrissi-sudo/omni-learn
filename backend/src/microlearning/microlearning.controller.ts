import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { MicrolearningService } from './microlearning.service';

/**
 * Microlearning Controller — Assigned content, feed, like, comment, share
 * omnilearn.space | Afflatus Consulting Group
 */
@Controller()
export class MicrolearningController {
  constructor(private readonly microlearning: MicrolearningService) {}

  @Get('users/:userId/assigned-content')
  getAssignedContent(@Param('userId') userId: string) {
    return this.microlearning.getAssignedContent(userId);
  }

  @Get('microlearning/feed')
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
  toggleLike(
    @Param('contentId') contentId: string,
    @Body() body: { userId: string },
  ) {
    return this.microlearning.toggleLike(contentId, body.userId);
  }

  @Get('microlearning/:contentId/comments')
  getComments(
    @Param('contentId') contentId: string,
    @Query('limit') limit?: string,
  ) {
    return this.microlearning.getComments(contentId, limit ? +limit : 50);
  }

  @Post('microlearning/:contentId/comments')
  addComment(
    @Param('contentId') contentId: string,
    @Body() body: { userId: string; body: string },
  ) {
    return this.microlearning.addComment(contentId, body.userId, body.body);
  }

  @Post('microlearning/:contentId/share')
  recordShare(
    @Param('contentId') contentId: string,
    @Body() body: { userId: string },
  ) {
    return this.microlearning.recordShare(contentId, body.userId);
  }
}
