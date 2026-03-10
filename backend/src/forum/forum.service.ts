import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Forum Service — Discussion forums + moderation
 * omnilearn.space | Afflatus Consulting Group
 */

@Injectable()
export class ForumService {
  constructor(private readonly prisma: PrismaService) {}

  async listChannels(contentId?: string, pathId?: string, tenantId?: string) {
    return this.prisma.forumChannel.findMany({
      where: {
        ...(contentId && { contentId }),
        ...(pathId && { pathId }),
        ...(tenantId && { tenantId }),
        isLocked: false,
      },
      include: {
        _count: { select: { topics: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createChannel(data: {
    name: string;
    slug: string;
    contentId?: string;
    pathId?: string;
    tenantId?: string;
    description?: string;
  }) {
    return this.prisma.forumChannel.create({ data });
  }

  async getChannel(id: string) {
    return this.prisma.forumChannel.findUniqueOrThrow({
      where: { id },
      include: { _count: { select: { topics: true } } },
    });
  }

  async listTopics(channelId: string, status?: string) {
    return this.prisma.forumTopic.findMany({
      where: {
        channelId,
        ...(status && { status }),
      },
      include: {
        _count: { select: { posts: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async createTopic(channelId: string, authorId: string, title: string, body: string) {
    const channel = await this.prisma.forumChannel.findUniqueOrThrow({
      where: { id: channelId },
    });
    if (channel.isLocked) throw new Error('Channel is locked');
    const topic = await this.prisma.forumTopic.create({
      data: { channelId, authorId, title, body },
    });
    // Create initial post so topic body appears in posts list and count is correct
    await this.prisma.forumPost.create({
      data: { topicId: topic.id, authorId, body },
    });
    return topic;
  }

  async getTopic(id: string) {
    return this.prisma.forumTopic.findUniqueOrThrow({
      where: { id },
      include: { posts: { where: { status: 'VISIBLE' }, orderBy: { createdAt: 'asc' } } },
    });
  }

  async addPost(topicId: string, authorId: string, body: string) {
    return this.prisma.forumPost.create({
      data: { topicId, authorId, body },
    });
  }

  async moderate(targetType: 'TOPIC' | 'POST', targetId: string, action: string, moderatorId: string, reason?: string) {
    const mod = await this.prisma.forumModeration.create({
      data: { targetType, targetId, action, moderatorId, reason },
    });
    if (action === 'HIDE' || action === 'DELETE') {
      if (targetType === 'TOPIC') {
        await this.prisma.forumTopic.update({
          where: { id: targetId },
          data: { status: action === 'HIDE' ? 'HIDDEN' : 'CLOSED' },
        });
      } else {
        await this.prisma.forumPost.update({
          where: { id: targetId },
          data: { status: action === 'HIDE' ? 'HIDDEN' : 'DELETED' },
        });
      }
    }
    return mod;
  }

  async pinTopic(topicId: string) {
    return this.prisma.forumTopic.update({
      where: { id: topicId },
      data: { status: 'PINNED' },
    });
  }

  async closeTopic(topicId: string) {
    return this.prisma.forumTopic.update({
      where: { id: topicId },
      data: { status: 'CLOSED' },
    });
  }
}
