import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ReviewService } from './review.service';

@Controller('reviews')
export class ReviewController {
  constructor(private readonly review: ReviewService) {}

  @Get('content/:contentId')
  getReviews(
    @Param('contentId') contentId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.review.getReviews(contentId, limit ? +limit : 20, offset ? +offset : 0);
  }

  @Get('content/:contentId/stats')
  getStats(@Param('contentId') contentId: string) {
    return this.review.getStats(contentId);
  }

  @Post('content/:contentId')
  createOrUpdate(
    @Param('contentId') contentId: string,
    @Body() body: { userId: string; rating: number; review?: string },
  ) {
    return this.review.createOrUpdate(contentId, body.userId, body.rating, body.review);
  }

  @Post('content/:contentId/helpful/:userId')
  markHelpful(@Param('contentId') contentId: string, @Param('userId') userId: string) {
    return this.review.markHelpful(contentId, userId);
  }
}
