import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ReviewService } from './review.service';
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';

@Controller('reviews')
export class ReviewController {
  constructor(private readonly review: ReviewService) {}

  @Get('content/:contentId')
  @UseGuards(OptionalJwtGuard)
  getReviews(
    @Param('contentId') contentId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.review.getReviews(contentId, limit ? +limit : 20, offset ? +offset : 0);
  }

  @Get('content/:contentId/stats')
  @UseGuards(OptionalJwtGuard)
  getStats(@Param('contentId') contentId: string) {
    return this.review.getStats(contentId);
  }

  @Post('content/:contentId')
  @UseGuards(AuthGuard('jwt'))
  createOrUpdate(
    @Param('contentId') contentId: string,
    @Body() body: { userId: string; rating: number; review?: string },
  ) {
    return this.review.createOrUpdate(contentId, body.userId, body.rating, body.review);
  }

  @Post('content/:contentId/helpful/:userId')
  @UseGuards(AuthGuard('jwt'))
  markHelpful(@Param('contentId') contentId: string, @Param('userId') userId: string) {
    return this.review.markHelpful(contentId, userId);
  }
}
