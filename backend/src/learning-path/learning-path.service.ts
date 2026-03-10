import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentStatus, StepProgressStatus } from '../constants/db.constant';

/**
 * Learning Path Orchestration Engine
 * omnilearn.space — Track enrollment & progress per step
 */

@Injectable()
export class LearningPathService {
  constructor(private readonly prisma: PrismaService) {}

  /** Enroll a user in a learning path */
  async enrollUser(userId: string, pathId: string, deadline?: Date) {
    const path = await this.prisma.learningPath.findUniqueOrThrow({
      where: { id: pathId, isPublished: true },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });

    const enrollment = await this.prisma.pathEnrollment.create({
      data: {
        userId,
        pathId,
        status: EnrollmentStatus.ACTIVE,
        progressPct: 0,
        deadline,
        stepProgress: {
          create: path.steps.map((step: { id: string }) => ({
            stepId: step.id,
            status: StepProgressStatus.NOT_STARTED,
          })),
        },
      },
      include: { stepProgress: true },
    });

    return enrollment;
  }

  /** Get enrollment with progress for a user */
  async getEnrollment(userId: string, pathId: string) {
    return this.prisma.pathEnrollment.findUnique({
      where: { userId_pathId: { userId, pathId } },
      include: {
        path: {
          include: {
            steps: {
              orderBy: { stepOrder: 'asc' },
              include: {
                contentItem: true,
                progress: {
                  where: { enrollment: { userId } },
                },
              },
            },
          },
        },
        stepProgress: { include: { step: { include: { contentItem: true } } } },
      },
    });
  }

  /** Update progress for a specific step */
  async updateStepProgress(
    enrollmentId: string,
    stepId: string,
    data: {
      status?: (typeof StepProgressStatus)[keyof typeof StepProgressStatus];
      timeSpent?: number;
      score?: number;
      completedAt?: Date;
    },
  ) {
    const progress = await this.prisma.pathStepProgress.update({
      where: {
        enrollmentId_stepId: { enrollmentId, stepId },
      },
      data: {
        ...data,
        ...(data.status === StepProgressStatus.COMPLETED && {
          completedAt: data.completedAt ?? new Date(),
        }),
      },
    });

    // Recalculate overall progress percentage
    await this.recalculateProgressPct(enrollmentId);

    return progress;
  }

  /** Recalculate enrollment progress percentage based on completed steps */
  private async recalculateProgressPct(enrollmentId: string) {
    const enrollment = await this.prisma.pathEnrollment.findUniqueOrThrow({
      where: { id: enrollmentId },
      include: {
        stepProgress: { include: { step: true } },
      },
    });

    const totalSteps = enrollment.stepProgress.length;
    const completedSteps = enrollment.stepProgress.filter(
      (p: { status: string }) => p.status === StepProgressStatus.COMPLETED,
    ).length;
    const progressPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    const allCompleted = completedSteps === totalSteps;

    await this.prisma.pathEnrollment.update({
      where: { id: enrollmentId },
      data: {
        progressPct,
        ...(allCompleted && {
          status: EnrollmentStatus.COMPLETED,
          completedAt: new Date(),
        }),
      },
    });
  }

  /** List published learning paths (optionally by domain) */
  async listPaths(tenantId: string, domainId?: string) {
    return this.prisma.learningPath.findMany({
      where: { tenantId, isPublished: true, ...(domainId && { domainId }) },
      include: { domain: true, _count: { select: { steps: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
