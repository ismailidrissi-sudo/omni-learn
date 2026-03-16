import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IntelligenceService } from './intelligence.service';
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';
import { RbacGuard } from '../auth/guards/rbac.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RbacRole } from '../constants/rbac.constant';

@Controller('intelligence')
export class IntelligenceController {
  constructor(private readonly intelligence: IntelligenceService) {}

  @Get('recommendations')
  @UseGuards(OptionalJwtGuard)
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
  @UseGuards(OptionalJwtGuard)
  semanticSearch(
    @Query('q') q: string,
    @Query('limit') limit?: string,
  ) {
    return this.intelligence.semanticSearch(q || '', limit ? +limit : 20);
  }

  @Get('path-suggestions')
  @UseGuards(OptionalJwtGuard)
  getPathSuggestions(
    @Query('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    return this.intelligence.getPathSuggestions(userId || 'anonymous', limit ? +limit : 5);
  }

  @Get('predictive')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.COMPANY_MANAGER)
  getPredictiveAnalytics(@Query('tenantId') tenantId?: string) {
    return this.intelligence.getPredictiveAnalytics(tenantId);
  }

  @Post('content/:contentId/embed')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.INSTRUCTOR)
  updateEmbedding(@Param('contentId') contentId: string) {
    return this.intelligence.updateContentEmbedding(contentId);
  }

  @Post('content/embed-all')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN)
  async embedAll() {
    return this.intelligence.embedAllContent();
  }

  @Get('lightfm/interactions')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN)
  getLightFmInteractions() {
    return this.intelligence.getLightFmInteractions();
  }
}
