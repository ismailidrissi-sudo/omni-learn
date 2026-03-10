import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { IntelligenceService } from './intelligence.service';

@Controller('intelligence')
export class IntelligenceController {
  constructor(private readonly intelligence: IntelligenceService) {}

  @Get('recommendations')
  getRecommendations(
    @Query('userId') userId: string,
    @Query('query') query?: string,
    @Query('limit') limit?: string,
  ) {
    return this.intelligence.getContentRecommendations(
      userId || 'anonymous',
      query,
      limit ? +limit : 10,
    );
  }

  @Get('search')
  semanticSearch(
    @Query('q') q: string,
    @Query('limit') limit?: string,
  ) {
    return this.intelligence.semanticSearch(q || '', limit ? +limit : 20);
  }

  @Get('path-suggestions')
  getPathSuggestions(
    @Query('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    return this.intelligence.getPathSuggestions(userId || 'anonymous', limit ? +limit : 5);
  }

  @Get('predictive')
  getPredictiveAnalytics(@Query('tenantId') tenantId?: string) {
    return this.intelligence.getPredictiveAnalytics(tenantId);
  }

  @Post('content/:contentId/embed')
  updateEmbedding(@Param('contentId') contentId: string) {
    return this.intelligence.updateContentEmbedding(contentId);
  }

  @Post('content/embed-all')
  async embedAll() {
    return this.intelligence.embedAllContent();
  }

  @Get('lightfm/interactions')
  getLightFmInteractions() {
    return this.intelligence.getLightFmInteractions();
  }
}
