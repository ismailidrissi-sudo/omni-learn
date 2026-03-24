import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CertificateService } from '../certificate/certificate.service';
import { NotificationService } from '../notification/notification.service';
import { TransactionalEmailService } from '../email/transactional-email.service';
import { ReferralService } from '../referral/referral.service';
import { EnrollmentStatus, StepProgressStatus } from '../constants/db.constant';

@Injectable()
export class CourseEnrollmentService {
  private readonly logger = new Logger(CourseEnrollmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly certificateService: CertificateService,
    private readonly notificationService: NotificationService,
    private readonly transactionalEmail: TransactionalEmailService,
    private readonly referralService: ReferralService,
  ) {}

  async enrollUser(userId: string, courseId: string, deadline?: Date, opts?: { actorUserId?: string }) {
    const existing = await this.prisma.courseEnrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      include: { itemProgress: true },
    });
    if (existing) {
      return existing;
    }

    const course = await this.prisma.contentItem.findUniqueOrThrow({
      where: { id: courseId },
      include: {
        courseSections: {
          orderBy: { sortOrder: 'asc' },
          include: { items: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    });

    const allItems = course.courseSections.flatMap((s) => s.items);

    const enrollment = await this.prisma.courseEnrollment.create({
      data: {
        userId,
        courseId,
        status: EnrollmentStatus.ACTIVE,
        progressPct: 0,
        deadline,
        itemProgress: {
          create: allItems.map((item: { id: string }) => ({
            sectionItemId: item.id,
            status: StepProgressStatus.NOT_STARTED,
          })),
        },
      },
      include: { itemProgress: true },
    });

    void this.notifyEnrollmentEmail(userId, courseId, course.title, opts?.actorUserId).catch((err) =>
      this.logger.warn(`Enrollment email failed: ${err}`),
    );

    /** Referral "converted" = referred user enrolled in at least one course (free or paid). */
    void this.referralService.convertReferral(userId).catch((err) =>
      this.logger.warn(`Referral convertReferral after course enrollment failed: ${err}`),
    );

    return enrollment;
  }

  private async notifyEnrollmentEmail(
    userId: string,
    courseId: string,
    courseTitle: string,
    actorUserId?: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;
    const enrolledBy =
      actorUserId && actorUserId !== userId ? 'admin' : 'self';
    let assignerName: string | undefined;
    if (enrolledBy === 'admin' && actorUserId) {
      const actor = await this.prisma.user.findUnique({ where: { id: actorUserId } });
      assignerName = actor?.name;
    }
    await this.transactionalEmail.sendEnrollmentConfirmed({
      userId,
      toEmail: user.email,
      toName: user.name,
      contentTitle: courseTitle,
      contentType: 'course',
      contentId: courseId,
      enrolledBy,
      assignerName,
    });
  }

  async getEnrollment(userId: string, courseId: string) {
    const enrollment = await this.prisma.courseEnrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      include: {
        course: {
          include: {
            domain: true,
            courseSections: {
              orderBy: { sortOrder: 'asc' },
              include: {
                items: {
                  orderBy: { sortOrder: 'asc' },
                  include: {
                    progress: {
                      where: { enrollment: { userId } },
                    },
                  },
                },
              },
            },
          },
        },
        itemProgress: {
          include: {
            sectionItem: {
              include: { section: true },
            },
          },
        },
        certificates: { orderBy: { issuedAt: 'desc' }, take: 1 },
      },
    });

    if (
      enrollment?.status === EnrollmentStatus.COMPLETED &&
      !enrollment.certificates?.length
    ) {
      await this.ensureCertificateIfMissing(enrollment.id);
      return this.prisma.courseEnrollment.findUnique({
        where: { userId_courseId: { userId, courseId } },
        include: {
          course: {
            include: {
              domain: true,
              courseSections: {
                orderBy: { sortOrder: 'asc' },
                include: {
                  items: {
                    orderBy: { sortOrder: 'asc' },
                    include: {
                      progress: {
                        where: { enrollment: { userId } },
                      },
                    },
                  },
                },
              },
            },
          },
          itemProgress: {
            include: {
              sectionItem: {
                include: { section: true },
              },
            },
          },
          certificates: { orderBy: { issuedAt: 'desc' }, take: 1 },
        },
      });
    }

    return enrollment;
  }

  async updateItemProgress(
    enrollmentId: string,
    sectionItemId: string,
    data: {
      status?: (typeof StepProgressStatus)[keyof typeof StepProgressStatus];
      timeSpent?: number;
      score?: number;
      completedAt?: Date;
    },
  ) {
    const progress = await this.prisma.courseSectionItemProgress.update({
      where: {
        enrollmentId_sectionItemId: { enrollmentId, sectionItemId },
      },
      data: {
        ...data,
        ...(data.status === StepProgressStatus.COMPLETED && {
          completedAt: data.completedAt ?? new Date(),
        }),
      },
    });

    const recalcResult = await this.recalculateProgressPct(enrollmentId);

    const enrollment = await this.prisma.courseEnrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        certificates: { orderBy: { issuedAt: 'desc' }, take: 1 },
      },
    });

    let certificate = enrollment?.certificates?.[0] ?? null;

    if (recalcResult.courseCompleted && !certificate) {
      certificate = await this.retryIssueCertificate(enrollmentId);
    }

    return {
      ...progress,
      enrollmentStatus: enrollment?.status,
      progressPct: enrollment?.progressPct,
      courseCompleted: recalcResult.courseCompleted,
      totalItems: recalcResult.totalItems,
      completedItems: recalcResult.completedItems,
      certificate,
    };
  }

  private async recalculateProgressPct(enrollmentId: string) {
    const enrollment = await this.prisma.courseEnrollment.findUniqueOrThrow({
      where: { id: enrollmentId },
      include: {
        itemProgress: true,
        course: { include: { domain: true } },
      },
    });

    const totalItems = enrollment.itemProgress.length;
    const completedItems = enrollment.itemProgress.filter(
      (p: { status: string }) => p.status === StepProgressStatus.COMPLETED,
    ).length;
    const progressPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    const wasAlreadyCompleted = enrollment.status === EnrollmentStatus.COMPLETED;
    const allCompleted = completedItems === totalItems && totalItems > 0;

    await this.prisma.courseEnrollment.update({
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

    return { courseCompleted: allCompleted, totalItems, completedItems };
  }

  /** Wallet UI is at /{academySlug}/certificates — never use bare /certificates (conflicts with [tenant] routing). */
  private async resolveWalletTenantSlugForCourseEnrollment(
    enrollmentId: string,
    userId: string,
  ): Promise<string> {
    const row = await this.prisma.courseEnrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        course: {
          include: {
            tenant: { select: { slug: true } },
            domain: { include: { tenant: { select: { slug: true } } } },
          },
        },
      },
    });
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: { select: { slug: true } } },
    });
    return (
      row?.course.tenant?.slug
      ?? row?.course.domain?.tenant?.slug
      ?? user?.tenant?.slug
      ?? process.env.DEFAULT_ACADEMY_SLUG
      ?? 'omnilearn'
    );
  }

  private async autoIssueCertificate(
    enrollmentId: string,
    enrollment: { userId: string; course: { title: string; domainId?: string | null; domain?: { name: string } | null } },
  ) {
    try {
      const existing = await this.prisma.issuedCertificate.findFirst({
        where: { courseEnrollmentId: enrollmentId },
      });
      if (existing) return;

      const cert = await this.certificateService.issueCourseEnrollmentCertificate(enrollmentId);
      this.logger.log(`Certificate auto-issued for course enrollment ${enrollmentId}`);

      try {
        await this.notificationService.notifyCertificateIssued({
          userId: enrollment.userId,
          certificateName: `${enrollment.course.domain?.name ?? ''} — ${enrollment.course.title}`,
          verifyCode: cert.verifyCode,
        });
      } catch (notifErr) {
        this.logger.warn(`Certificate issued but notification failed for course enrollment ${enrollmentId}`, notifErr);
      }

      try {
        const learner = await this.prisma.user.findUnique({ where: { id: enrollment.userId } });
        if (learner) {
          const tenantSlug = await this.resolveWalletTenantSlugForCourseEnrollment(
            enrollmentId,
            enrollment.userId,
          );
          await this.transactionalEmail.sendCompletionCertificateEmail({
            userId: learner.id,
            toEmail: learner.email,
            toName: learner.name,
            contentTitle: enrollment.course.title,
            contentType: 'course',
            verifyCode: cert.verifyCode,
            certificateId: cert.id,
            tenantSlug,
          });
        }
      } catch (mailErr) {
        this.logger.warn(`Completion email failed for course enrollment ${enrollmentId}`, mailErr);
      }
    } catch (err) {
      this.logger.error(`Failed to auto-issue certificate for course enrollment ${enrollmentId}`, err);
    }
  }

  private async retryIssueCertificate(enrollmentId: string) {
    try {
      const existing = await this.prisma.issuedCertificate.findFirst({
        where: { courseEnrollmentId: enrollmentId },
      });
      if (existing) return existing;

      const cert = await this.certificateService.issueCourseEnrollmentCertificate(enrollmentId);
      this.logger.log(`Certificate issued via retry for course enrollment ${enrollmentId}`);
      try {
        const enroll = await this.prisma.courseEnrollment.findUnique({
          where: { id: enrollmentId },
          include: { course: true },
        });
        const learner = enroll
          ? await this.prisma.user.findUnique({ where: { id: enroll.userId } })
          : null;
        if (enroll && learner) {
          const tenantSlug = await this.resolveWalletTenantSlugForCourseEnrollment(
            enrollmentId,
            learner.id,
          );
          await this.transactionalEmail.sendCompletionCertificateEmail({
            userId: learner.id,
            toEmail: learner.email,
            toName: learner.name,
            contentTitle: enroll.course.title,
            contentType: 'course',
            verifyCode: cert.verifyCode,
            certificateId: cert.id,
            tenantSlug,
          });
        }
      } catch (mailErr) {
        this.logger.warn(`Completion email failed on retry for course enrollment ${enrollmentId}`, mailErr);
      }
      return cert;
    } catch (err) {
      this.logger.error(`Certificate retry also failed for course enrollment ${enrollmentId}`, err);
      return null;
    }
  }

  /** If enrollment is completed but issuance failed earlier, issue now (idempotent). */
  private async ensureCertificateIfMissing(enrollmentId: string) {
    const row = await this.prisma.courseEnrollment.findUnique({
      where: { id: enrollmentId },
      select: { status: true, certificates: { select: { id: true }, take: 1 } },
    });
    if (!row || row.status !== EnrollmentStatus.COMPLETED) return;
    if (row.certificates.length > 0) return;
    await this.retryIssueCertificate(enrollmentId);
  }

  async findEnrollmentForCourse(userId: string, courseId: string) {
    const enrollment = await this.prisma.courseEnrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      include: {
        course: { include: { domain: true } },
        certificates: { orderBy: { issuedAt: 'desc' }, take: 1 },
      },
    });

    if (!enrollment) return null;

    if (enrollment.status === EnrollmentStatus.COMPLETED && !enrollment.certificates?.length) {
      await this.ensureCertificateIfMissing(enrollment.id);
      const refreshed = await this.prisma.courseEnrollment.findUnique({
        where: { userId_courseId: { userId, courseId } },
        include: {
          course: { include: { domain: true } },
          certificates: { orderBy: { issuedAt: 'desc' }, take: 1 },
        },
      });
      if (!refreshed) return null;
      return {
        enrollmentId: refreshed.id,
        enrollmentType: 'course' as const,
        courseTitle: refreshed.course.title,
        domainName: refreshed.course.domain?.name ?? '',
        progressPct: refreshed.progressPct,
        status: refreshed.status,
        certificate: refreshed.certificates?.[0] ?? null,
      };
    }

    return {
      enrollmentId: enrollment.id,
      enrollmentType: 'course' as const,
      courseTitle: enrollment.course.title,
      domainName: enrollment.course.domain?.name ?? '',
      progressPct: enrollment.progressPct,
      status: enrollment.status,
      certificate: enrollment.certificates?.[0] ?? null,
    };
  }

  async getUserCourseEnrollments(userId: string) {
    return this.prisma.courseEnrollment.findMany({
      where: { userId },
      include: {
        course: { include: { domain: true } },
        certificates: { orderBy: { issuedAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
