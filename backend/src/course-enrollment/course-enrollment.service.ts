import { Injectable, Logger } from '@nestjs/common';
import { CourseItemType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CertificateService } from '../certificate/certificate.service';
import { NotificationService } from '../notification/notification.service';
import { TransactionalEmailService } from '../email/transactional-email.service';
import { ReferralService } from '../referral/referral.service';
import { GamificationService } from '../gamification/gamification.service';
import { POINT_REASONS } from '../gamification/gamification.rules';
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
    private readonly gamification: GamificationService,
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
    const prior = await this.prisma.courseSectionItemProgress.findUnique({
      where: {
        enrollmentId_sectionItemId: { enrollmentId, sectionItemId },
      },
      include: {
        sectionItem: true,
        enrollment: {
          include: {
            user: { select: { id: true, tenantId: true } },
            course: {
              select: {
                tenantId: true,
                domain: { select: { tenantId: true } },
              },
            },
          },
        },
      },
    });

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

    if (data.status === StepProgressStatus.COMPLETED && prior) {
      void this.applyCourseItemCompletionGamification(prior, progress).catch((err) =>
        this.logger.warn(`Gamification grant failed (non-fatal): ${err}`),
      );
    }

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

  private async applyCourseItemCompletionGamification(
    prior: {
      status: string;
      enrollmentId: string;
      sectionItemId: string;
      sectionItem: { itemType: CourseItemType };
      enrollment: {
        userId: string;
        user: { tenantId: string | null };
        course: {
          tenantId: string | null;
          domain: { tenantId: string } | null;
        };
      };
    },
    progress: { id: string; updatedAt: Date },
  ): Promise<void> {
    const tenantId =
      prior.enrollment.user.tenantId ??
      prior.enrollment.course.tenantId ??
      prior.enrollment.course.domain?.tenantId ??
      null;
    if (!tenantId) {
      this.logger.warn(
        `Skipping gamification: no tenant for user ${prior.enrollment.userId}`,
      );
      return;
    }
    const userId = prior.enrollment.userId;

    if (prior.sectionItem.itemType === CourseItemType.QUIZ) {
      const isFirstPass = prior.status !== StepProgressStatus.COMPLETED;
      const idempotencyKey = isFirstPass
        ? `quiz_pass_first:${prior.enrollmentId}:${prior.sectionItemId}`
        : `quiz_pass_retake:${prior.enrollmentId}:${prior.sectionItemId}:${progress.updatedAt.toISOString()}`;
      await this.gamification.grantPoints({
        userId,
        tenantId,
        reason: isFirstPass
          ? POINT_REASONS.QUIZ_PASS_FIRST
          : POINT_REASONS.QUIZ_PASS_RETAKE,
        sourceType: 'quiz_attempt',
        sourceId: progress.id,
        idempotencyKey,
      });
      return;
    }

    await this.gamification.grantPoints({
      userId,
      tenantId,
      reason: POINT_REASONS.LESSON_COMPLETE,
      sourceType: 'lesson',
      sourceId: prior.sectionItemId,
      idempotencyKey: `lesson_complete:${userId}:${prior.sectionItemId}`,
    });
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

  async getCourseEnrollments(courseId: string) {
    return this.prisma.courseEnrollment.findMany({
      where: { courseId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCourseAnalytics(courseId: string) {
    const course = await this.prisma.contentItem.findUnique({
      where: { id: courseId },
      include: {
        courseSections: {
          include: {
            items: { select: { id: true } },
          },
        },
      },
    });

    const totalItems = course
      ? course.courseSections.reduce((acc, section) => acc + section.items.length, 0)
      : 0;

    const enrollments = await this.prisma.courseEnrollment.findMany({
      where: { courseId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        itemProgress: {
          select: {
            status: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const userIds = [...new Set(enrollments.map((e) => e.userId))];
    const [sessions, accessLogs] = await Promise.all([
      userIds.length
        ? this.prisma.userSession.findMany({
          where: { userId: { in: userIds } },
          select: {
            userId: true,
            ipAddress: true,
            country: true,
            countryCode: true,
            startedAt: true,
          },
          orderBy: { startedAt: 'desc' },
        })
        : Promise.resolve([]),
      userIds.length
        ? this.prisma.contentAccessLog.findMany({
          where: {
            contentId: courseId,
            userId: { in: userIds },
          },
          select: {
            userId: true,
            ipAddress: true,
            country: true,
            countryCode: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        })
        : Promise.resolve([]),
    ]);

    const latestSessionByUser = new Map<string, (typeof sessions)[number]>();
    for (const session of sessions) {
      if (!latestSessionByUser.has(session.userId)) {
        latestSessionByUser.set(session.userId, session);
      }
    }

    const latestAccessByUser = new Map<string, (typeof accessLogs)[number]>();
    for (const log of accessLogs) {
      if (!latestAccessByUser.has(log.userId)) {
        latestAccessByUser.set(log.userId, log);
      }
    }

    const participants = enrollments.map((enrollment) => {
      const consumedItems = enrollment.itemProgress.filter(
        (p) => p.status !== StepProgressStatus.NOT_STARTED,
      ).length;
      const advancementPct = totalItems > 0
        ? Math.round((consumedItems / totalItems) * 100)
        : 0;

      const latestSession = latestSessionByUser.get(enrollment.userId);
      const latestAccess = latestAccessByUser.get(enrollment.userId);
      const country = latestSession?.country || latestAccess?.country || 'Unknown';
      const countryCode = latestSession?.countryCode || latestAccess?.countryCode || null;
      const ipAddress = latestSession?.ipAddress || latestAccess?.ipAddress || null;
      const lastSeenAt = latestSession?.startedAt || latestAccess?.createdAt || enrollment.updatedAt;

      return {
        userId: enrollment.userId,
        user: enrollment.user,
        status: enrollment.status,
        progressPct: enrollment.progressPct,
        consumedItems,
        totalItems,
        advancementPct,
        country,
        countryCode,
        ipAddress,
        enrolledAt: enrollment.createdAt,
        lastSeenAt,
      };
    });

    const countryMap = new Map<string, { country: string; countryCode: string | null; participants: Set<string>; views: number }>();
    for (const log of accessLogs) {
      const country = log.country || 'Unknown';
      const key = `${log.countryCode || 'XX'}:${country}`;
      const existing = countryMap.get(key) ?? {
        country,
        countryCode: log.countryCode || null,
        participants: new Set<string>(),
        views: 0,
      };
      existing.participants.add(log.userId);
      existing.views += 1;
      countryMap.set(key, existing);
    }

    const ipMap = new Map<string, { ipAddress: string; participants: Set<string>; views: number; country: string }>();
    for (const log of accessLogs) {
      if (!log.ipAddress) continue;
      const key = log.ipAddress;
      const existing = ipMap.get(key) ?? {
        ipAddress: log.ipAddress,
        participants: new Set<string>(),
        views: 0,
        country: log.country || 'Unknown',
      };
      existing.participants.add(log.userId);
      existing.views += 1;
      ipMap.set(key, existing);
    }

    const avgAdvancementPct = participants.length
      ? Math.round(participants.reduce((sum, p) => sum + p.advancementPct, 0) / participants.length)
      : 0;
    const completedCount = participants.filter((p) => p.status === EnrollmentStatus.COMPLETED).length;
    const activeCount = participants.filter((p) => p.status === EnrollmentStatus.ACTIVE).length;

    return {
      courseId,
      totalItems,
      totalParticipants: participants.length,
      overview: {
        avgAdvancementPct,
        completedCount,
        activeCount,
      },
      participants: participants.sort((a, b) => b.advancementPct - a.advancementPct),
      countries: [...countryMap.values()]
        .map((row) => ({
          country: row.country,
          countryCode: row.countryCode,
          participants: row.participants.size,
          views: row.views,
        }))
        .sort((a, b) => b.participants - a.participants),
      ips: [...ipMap.values()]
        .map((row) => ({
          ipAddress: row.ipAddress,
          participants: row.participants.size,
          views: row.views,
          country: row.country,
        }))
        .sort((a, b) => b.views - a.views),
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
