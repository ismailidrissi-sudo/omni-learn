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

    const recalcResult = await this.recalculateProgressPct(enrollmentId);

    const enrollment = await this.prisma.pathEnrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        certificates: { orderBy: { issuedAt: 'desc' }, take: 1 },
      },
    });

    let certificate = enrollment?.certificates?.[0] ?? null;

    if (recalcResult.pathCompleted && !certificate) {
      certificate = await this.retryIssueCertificate(enrollmentId);
    }

    return {
      ...progress,
      enrollmentStatus: enrollment?.status,
      progressPct: enrollment?.progressPct,
      pathCompleted: recalcResult.pathCompleted,
      totalSteps: recalcResult.totalSteps,
      completedSteps: recalcResult.completedSteps,
      certificate,
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
        ...(allCompleted && !wasAlreadyCompleted && {
          status: EnrollmentStatus.COMPLETED,
          completedAt: new Date(),
        }),
      },
    });

    if (allCompleted && !wasAlreadyCompleted) {
      await this.autoIssueCertificate(enrollmentId, enrollment);
    }

    return { pathCompleted: allCompleted, totalSteps, completedSteps };
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

      this.logger.log(`Certificate auto-issued for enrollment ${enrollmentId}`);

      try {
        await this.notificationService.notifyCertificateIssued({
          userId: enrollment.userId,
          tenantId: enrollment.path.tenantId,
          certificateName: `${enrollment.path.domain?.name ?? ''} — ${enrollment.path.name}`,
          verifyCode: cert.verifyCode,
        });
      } catch (notifErr) {
        this.logger.warn(`Certificate issued but notification failed for enrollment ${enrollmentId}`, notifErr);
      }
    } catch (err) {
      this.logger.error(`Failed to auto-issue certificate for enrollment ${enrollmentId}`, err);
    }
  }

  /** Fallback: try to issue certificate if auto-issue was missed or failed */
  private async retryIssueCertificate(enrollmentId: string) {
    try {
      const existing = await this.prisma.issuedCertificate.findFirst({
        where: { enrollmentId },
      });
      if (existing) return existing;

      const cert = await this.certificateService.issueCertificate(enrollmentId);
      this.logger.log(`Certificate issued via retry for enrollment ${enrollmentId}`);
      return cert;
    } catch (err) {
      this.logger.error(`Certificate retry also failed for enrollment ${enrollmentId}`, err);
      return null;
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

  /** Find or auto-enroll a user for a content item that belongs to a learning path */
  async findOrAutoEnrollForContent(userId: string, contentItemId: string) {
    const existing = await this.findEnrollmentForContent(userId, contentItemId);
    if (existing) return existing;

    const step = await this.prisma.learningPathStep.findFirst({
      where: { contentItemId },
      include: { path: true },
      orderBy: { path: { createdAt: 'desc' } },
    });
    if (!step || !step.path.isPublished) return null;

    const alreadyEnrolled = await this.prisma.pathEnrollment.findUnique({
      where: { userId_pathId: { userId, pathId: step.pathId } },
    });
    if (!alreadyEnrolled) {
      await this.enrollUser(userId, step.pathId);
    }

    return this.findEnrollmentForContent(userId, contentItemId);
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
