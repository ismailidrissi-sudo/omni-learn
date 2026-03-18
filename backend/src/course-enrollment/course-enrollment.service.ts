import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CertificateService } from '../certificate/certificate.service';
import { NotificationService } from '../notification/notification.service';
import { EnrollmentStatus, StepProgressStatus } from '../constants/db.constant';

@Injectable()
export class CourseEnrollmentService {
  private readonly logger = new Logger(CourseEnrollmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly certificateService: CertificateService,
    private readonly notificationService: NotificationService,
  ) {}

  async enrollUser(userId: string, courseId: string, deadline?: Date) {
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

    return enrollment;
  }

  async getEnrollment(userId: string, courseId: string) {
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
        });
      } catch (notifErr) {
        this.logger.warn(`Certificate issued but notification failed for course enrollment ${enrollmentId}`, notifErr);
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
      return cert;
    } catch (err) {
      this.logger.error(`Certificate retry also failed for course enrollment ${enrollmentId}`, err);
      return null;
    }
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
