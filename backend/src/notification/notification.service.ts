import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async getForUser(userId: string, limit = 20) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  async markAsRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async create(data: {
    userId: string;
    tenantId?: string;
    type: string;
    title: string;
    body?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.prisma.notification.create({
      data: {
        userId: data.userId,
        tenantId: data.tenantId,
        type: data.type,
        title: data.title,
        body: data.body,
        metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : undefined,
      },
    });
  }

  async notifyTrainingAssigned(params: {
    userId: string;
    tenantId: string;
    trainingTitle: string;
    dueDate: Date;
  }) {
    return this.create({
      userId: params.userId,
      tenantId: params.tenantId,
      type: 'TRAINING_ASSIGNED',
      title: 'New Training Assigned',
      body: `You have been assigned "${params.trainingTitle}". Due by ${params.dueDate.toLocaleDateString()}.`,
      metadata: { dueDate: params.dueDate.toISOString() },
    });
  }

  async notifyPathCompleted(params: {
    userId: string;
    tenantId?: string;
    pathName: string;
  }) {
    return this.create({
      userId: params.userId,
      tenantId: params.tenantId,
      type: 'PATH_COMPLETED',
      title: 'Learning Path Completed!',
      body: `Congratulations! You completed "${params.pathName}".`,
    });
  }

  async notifyCertificateIssued(params: {
    userId: string;
    tenantId?: string;
    certificateName: string;
    verifyCode: string;
  }) {
    return this.create({
      userId: params.userId,
      tenantId: params.tenantId,
      type: 'CERTIFICATE_ISSUED',
      title: 'Certificate Earned!',
      body: `You earned a certificate for "${params.certificateName}".`,
      metadata: { verifyCode: params.verifyCode },
    });
  }
}
