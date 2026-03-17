import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentStatus, StepProgressStatus } from '../constants/db.constant';
import { CertificateService } from '../certificate/certificate.service';
import { NotificationService } from '../notification/notification.service';

/**
 * Learning Path Orchestration Engine
 * omnilearn.space — Track enrollment & progress per step
 */

@Injectable()
export class LearningPathService {
  private readonly logger = new Logger(LearningPathService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly certificateService: CertificateService,
    private readonly notificationService: NotificationService,
  ) {}

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

    await this.recalculateProgressPct(enrollmentId);

    const enrollment = await this.prisma.pathEnrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        certificates: { orderBy: { issuedAt: 'desc' }, take: 1 },
      },
    });

    return {
      ...progress,
      enrollmentStatus: enrollment?.status,
      progressPct: enrollment?.progressPct,
      certificate: enrollment?.certificates?.[0] ?? null,
    };
  }

  /** Recalculate enrollment progress percentage based on completed steps */
  private async recalculateProgressPct(enrollmentId: string) {
    const enrollment = await this.prisma.pathEnrollment.findUniqueOrThrow({
      where: { id: enrollmentId },
      include: {
        stepProgress: { include: { step: true } },
        path: { include: { domain: true } },
      },
    });

    const totalSteps = enrollment.stepProgress.length;
    const completedSteps = enrollment.stepProgress.filter(
      (p: { status: string }) => p.status === StepProgressStatus.COMPLETED,
    ).length;
    const progressPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    const wasAlreadyCompleted = enrollment.status === EnrollmentStatus.COMPLETED;
    const allCompleted = completedSteps === totalSteps && totalSteps > 0;

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

    if (allCompleted && !wasAlreadyCompleted) {
      await this.autoIssueCertificate(enrollmentId, enrollment);
    }
  }

  /** Auto-issue certificate and notify user when a learning path is completed */
  private async autoIssueCertificate(
    enrollmentId: string,
    enrollment: { userId: string; path: { name: string; tenantId: string; domain: { name: string } | null } },
  ) {
    try {
      const existing = await this.prisma.issuedCertificate.findFirst({
        where: { enrollmentId },
      });
      if (existing) return;

      const cert = await this.certificateService.issueCertificate(enrollmentId);

      await this.notificationService.notifyCertificateIssued({
        userId: enrollment.userId,
        tenantId: enrollment.path.tenantId,
        certificateName: `${enrollment.path.domain?.name ?? ''} — ${enrollment.path.name}`,
        verifyCode: cert.verifyCode,
      });

      this.logger.log(`Certificate auto-issued for enrollment ${enrollmentId}`);
    } catch (err) {
      this.logger.error(`Failed to auto-issue certificate for enrollment ${enrollmentId}`, err);
    }
  }

  /** Find the user's enrollment context for a given content item (ACTIVE preferred, then COMPLETED) */
  async findEnrollmentForContent(userId: string, contentItemId: string) {
    const rows = await this.prisma.pathStepProgress.findMany({
      where: {
        enrollment: { userId, status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED] } },
        step: { contentItemId },
      },
      include: {
        enrollment: {
          include: {
            path: { include: { domain: true } },
            certificates: { orderBy: { issuedAt: 'desc' }, take: 1 },
          },
        },
        step: true,
      },
      orderBy: { enrollment: { status: 'asc' } },
    });

    const stepProgress = rows[0];
    if (!stepProgress) return null;

    return {
      enrollmentId: stepProgress.enrollmentId,
      stepId: stepProgress.stepId,
      stepStatus: stepProgress.status,
      pathName: stepProgress.enrollment.path.name,
      domainName: stepProgress.enrollment.path.domain?.name ?? '',
      progressPct: stepProgress.enrollment.progressPct,
      certificate: stepProgress.enrollment.certificates?.[0] ?? null,
    };
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
