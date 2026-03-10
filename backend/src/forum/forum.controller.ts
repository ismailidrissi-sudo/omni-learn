import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { ForumService } from './forum.service';

@Controller('forum')
export class ForumController {
  constructor(private readonly forum: ForumService) {}

  @Get('channels')
  listChannels(
    @Query('contentId') contentId?: string,
    @Query('pathId') pathId?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.forum.listChannels(contentId, pathId, tenantId);
  }

  @Post('channels')
  createChannel(@Body() body: { name: string; slug: string; contentId?: string; pathId?: string; tenantId?: string; description?: string }) {
    return this.forum.createChannel(body);
  }

  @Get('channels/:id')
  getChannel(@Param('id') id: string) {
    return this.forum.getChannel(id);
  }

  @Get('channels/:channelId/topics')
  listTopics(@Param('channelId') channelId: string, @Query('status') status?: string) {
    return this.forum.listTopics(channelId, status);
  }

  @Post('channels/:channelId/topics')
  createTopic(
    @Param('channelId') channelId: string,
    @Body() body: { authorId: string; title: string; body: string },
  ) {
    return this.forum.createTopic(channelId, body.authorId, body.title, body.body);
  }

  @Get('topics/:id')
  getTopic(@Param('id') id: string) {
    return this.forum.getTopic(id);
  }

  @Post('topics/:topicId/posts')
  addPost(
    @Param('topicId') topicId: string,
    @Body() body: { authorId: string; body: string },
  ) {
    return this.forum.addPost(topicId, body.authorId, body.body);
  }

  @Post('moderate')
  moderate(
    @Body() body: { targetType: 'TOPIC' | 'POST'; targetId: string; action: string; moderatorId: string; reason?: string },
  ) {
    return this.forum.moderate(body.targetType, body.targetId, body.action, body.moderatorId, body.reason);
  }

  @Put('topics/:topicId/pin')
  pinTopic(@Param('topicId') topicId: string) {
    return this.forum.pinTopic(topicId);
  }

  @Put('topics/:topicId/close')
  closeTopic(@Param('topicId') topicId: string) {
    return this.forum.closeTopic(topicId);
  }
}
