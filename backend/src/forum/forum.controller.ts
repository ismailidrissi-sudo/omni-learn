import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ForumService } from './forum.service';
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';
import { RbacGuard } from '../auth/guards/rbac.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RbacRole } from '../constants/rbac.constant';

@Controller('forum')
export class ForumController {
  constructor(private readonly forum: ForumService) {}

  @Get('channels')
  @UseGuards(OptionalJwtGuard)
  listChannels(
    @Query('contentId') contentId?: string,
    @Query('pathId') pathId?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.forum.listChannels(contentId, pathId, tenantId);
  }

  @Post('channels')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.CONTENT_MODERATOR)
  createChannel(@Body() body: { name: string; slug: string; contentId?: string; pathId?: string; tenantId?: string; description?: string }) {
    return this.forum.createChannel(body);
  }

  @Get('channels/:id')
  @UseGuards(OptionalJwtGuard)
  getChannel(@Param('id') id: string) {
    return this.forum.getChannel(id);
  }

  @Get('channels/:channelId/topics')
  @UseGuards(OptionalJwtGuard)
  listTopics(@Param('channelId') channelId: string, @Query('status') status?: string) {
    return this.forum.listTopics(channelId, status);
  }

  @Post('channels/:channelId/topics')
  @UseGuards(AuthGuard('jwt'))
  createTopic(
    @Param('channelId') channelId: string,
    @Body() body: { authorId: string; title: string; body: string },
  ) {
    return this.forum.createTopic(channelId, body.authorId, body.title, body.body);
  }

  @Get('topics/:id')
  @UseGuards(OptionalJwtGuard)
  getTopic(@Param('id') id: string) {
    return this.forum.getTopic(id);
  }

  @Post('topics/:topicId/posts')
  @UseGuards(AuthGuard('jwt'))
  addPost(
    @Param('topicId') topicId: string,
    @Body() body: { authorId: string; body: string },
  ) {
    return this.forum.addPost(topicId, body.authorId, body.body);
  }

  @Post('moderate')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.CONTENT_MODERATOR)
  moderate(
    @Body() body: { targetType: 'TOPIC' | 'POST'; targetId: string; action: string; moderatorId: string; reason?: string },
  ) {
    return this.forum.moderate(body.targetType, body.targetId, body.action, body.moderatorId, body.reason);
  }

  @Put('topics/:topicId/pin')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.CONTENT_MODERATOR)
  pinTopic(@Param('topicId') topicId: string) {
    return this.forum.pinTopic(topicId);
  }

  @Put('topics/:topicId/close')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.CONTENT_MODERATOR)
  closeTopic(@Param('topicId') topicId: string) {
    return this.forum.closeTopic(topicId);
  }
}
