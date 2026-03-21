import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentStatus, StepProgressStatus } from '../constants/db.constant';
import { CertificateService } from '../certificate/certificate.service';
import { NotificationService } from '../notification/notification.service';
import { TransactionalEmailService } from '../email/transactional-email.service';

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
    private readonly transactionalEmail: TransactionalEmailService,
  ) {}

  /** Enroll a user in a learning path (idempotent — returns existing enrollment if already enrolled) */
  async enrollUser(userId: string, pathId: string, deadline?: Date, opts?: { actorUserId?: string }) {
    const existing = await this.prisma.pathEnrollment.findUnique({
      where: { userId_pathId: { userId, pathId } },
      include: { stepProgress: true },
    });
    if (existing) return existing;

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

    void this.notifyPathEnrollmentEmail(userId, pathId, path.name, opts?.actorUserId).catch((err) =>
      this.logger.warn(`Path enrollment email failed: ${err}`),
    );

    return enrollment;
  }

  private async notifyPathEnrollmentEmail(
    userId: string,
    pathId: string,
    pathName: string,
    actorUserId?: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;
    const enrolledBy = actorUserId && actorUserId !== userId ? 'admin' : 'self';
    let assignerName: string | undefined;
    if (enrolledBy === 'admin' && actorUserId) {
      const actor = await this.prisma.user.findUnique({ where: { id: actorUserId } });
      assignerName = actor?.name;
    }
    await this.transactionalEmail.sendEnrollmentConfirmed({
      userId,
      toEmail: user.email,
      toName: user.name,
      contentTitle: pathName,
      contentType: 'path',
      contentId: pathId,
      enrolledBy,
      assignerName,
    });
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

      try {
        const learner = await this.prisma.user.findUnique({ where: { id: enrollment.userId } });
        if (learner) {
          await this.transactionalEmail.sendCompletionCertificateEmail({
            userId: learner.id,
            toEmail: learner.email,
            toName: learner.name,
            contentTitle: enrollment.path.name,
            contentType: 'path',
            verifyCode: cert.verifyCode,
            certificateId: cert.id,
          });
        }
      } catch (mailErr) {
        this.logger.warn(`Completion email failed for path enrollment ${enrollmentId}`, mailErr);
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
      try {
        const enroll = await this.prisma.pathEnrollment.findUnique({
          where: { id: enrollmentId },
          include: { path: true },
        });
        const learner = enroll
          ? await this.prisma.user.findUnique({ where: { id: enroll.userId } })
          : null;
        if (enroll && learner) {
          await this.transactionalEmail.sendCompletionCertificateEmail({
            userId: learner.id,
            toEmail: learner.email,
            toName: learner.name,
            contentTitle: enroll.path.name,
            contentType: 'path',
            verifyCode: cert.verifyCode,
            certificateId: cert.id,
          });
        }
      } catch (mailErr) {
        this.logger.warn(`Completion email failed on retry for enrollment ${enrollmentId}`, mailErr);
      }
      return cert;
    } catch (err) {
      this.logger.error(`Certificate retry also failed for enrollment ${enrollmentId}`, err);
      return null;
    }
  }

  /** If path enrollment is completed but issuance failed earlier, issue now (idempotent). */
  private async ensurePathCertificateIfMissing(enrollmentId: string) {
    const row = await this.prisma.pathEnrollment.findUnique({
      where: { id: enrollmentId },
      select: { status: true, certificates: { select: { id: true }, take: 1 } },
    });
    if (!row || row.status !== EnrollmentStatus.COMPLETED) return;
    if (row.certificates.length > 0) return;
    await this.retryIssueCertificate(enrollmentId);
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

    if (
      stepProgress.enrollment.status === EnrollmentStatus.COMPLETED &&
      !stepProgress.enrollment.certificates?.length
    ) {
      await this.ensurePathCertificateIfMissing(stepProgress.enrollmentId);
      const refreshed = await this.prisma.pathEnrollment.findUnique({
        where: { id: stepProgress.enrollmentId },
        include: {
          path: { include: { domain: true } },
          certificates: { orderBy: { issuedAt: 'desc' }, take: 1 },
        },
      });
      if (refreshed) {
        return {
          enrollmentId: stepProgress.enrollmentId,
          stepId: stepProgress.stepId,
          stepStatus: stepProgress.status,
          pathName: refreshed.path.name,
          domainName: refreshed.path.domain?.name ?? '',
          progressPct: refreshed.progressPct,
          certificate: refreshed.certificates?.[0] ?? null,
        };
      }
    }

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

  /** List all path enrollments for a given user */
  async getUserPathEnrollments(userId: string) {
    return this.prisma.pathEnrollment.findMany({
      where: { userId },
      include: {
        path: { include: { domain: true } },
        stepProgress: true,
        certificates: { orderBy: { issuedAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
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
