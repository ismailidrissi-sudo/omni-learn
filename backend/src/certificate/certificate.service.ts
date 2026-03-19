import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DomainsService } from '../domains/domains.service';
import { EnrollmentStatus } from '../constants/db.constant';

/**
 * Certificate Service — Progress tracking + certificate issuance
 * Domain-themed templates (from Domain entity, NOT hardcoded) | omnilearn.space | Afflatus Consulting Group
 */

@Injectable()
export class CertificateService implements OnModuleInit {
  private readonly logger = new Logger(CertificateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly domainsService: DomainsService,
  ) {}

  async onModuleInit() {
    setTimeout(() => this.backfillMissingCertificates(), 5000);
  }

  /**
   * Find all completed path + course enrollments that have no certificate
   * and issue one for each. Runs on startup and can be triggered via API.
   */
  async backfillMissingCertificates() {
    let issued = 0;

    const completedPathEnrollments = await this.prisma.pathEnrollment.findMany({
      where: {
        status: EnrollmentStatus.COMPLETED,
        certificates: { none: {} },
      },
      include: { path: { include: { domain: true } } },
    });

    for (const enrollment of completedPathEnrollments) {
      try {
        await this.issueCertificate(enrollment.id);
        issued++;
        this.logger.log(`Backfilled path certificate for enrollment ${enrollment.id}`);
      } catch (err) {
        this.logger.warn(`Backfill skipped path enrollment ${enrollment.id}: ${err}`);
      }
    }

    const completedCourseEnrollments = await this.prisma.courseEnrollment.findMany({
      where: {
        status: EnrollmentStatus.COMPLETED,
        certificates: { none: {} },
      },
      include: { course: { include: { domain: true } } },
    });

    for (const enrollment of completedCourseEnrollments) {
      try {
        await this.issueCourseEnrollmentCertificate(enrollment.id);
        issued++;
        this.logger.log(`Backfilled course certificate for enrollment ${enrollment.id}`);
      } catch (err) {
        this.logger.warn(`Backfill skipped course enrollment ${enrollment.id}: ${err}`);
      }
    }

    this.logger.log(`Certificate backfill complete: ${issued} certificates issued`);
    return { issued };
  }

  /** Get or create domain-themed certificate template (template derived from Domain entity) */
  async getOrCreateTemplate(tenantId: string, domainId: string) {
    return this.domainsService.ensureCertificateTemplate(
      tenantId,
      domainId,
      '', // Will be resolved from domain
      '',
    );
  }

  /** Issue certificate when path is completed */
  async issueCertificate(enrollmentId: string, grade?: string) {
    const enrollment = await this.prisma.pathEnrollment.findUniqueOrThrow({
      where: { id: enrollmentId },
      include: { path: { include: { domain: true } } },
    });
    if (enrollment.status !== EnrollmentStatus.COMPLETED) {
      throw new Error('Enrollment must be completed to issue certificate');
    }

    const template = await this.domainsService.ensureCertificateTemplate(
      enrollment.path.tenantId,
      enrollment.path.domainId,
      enrollment.path.domain.color,
      enrollment.path.domain.name,
    );
    const verifyCode = `LC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    return this.prisma.issuedCertificate.create({
      data: {
        templateId: template.id,
        enrollmentId,
        verifyCode,
        grade: (grade as 'PASS' | 'MERIT' | 'DISTINCTION') ?? undefined,
      },
    });
  }

  /** Issue certificate when course enrollment is completed */
  async issueCourseEnrollmentCertificate(courseEnrollmentId: string, grade?: string) {
    const enrollment = await this.prisma.courseEnrollment.findUniqueOrThrow({
      where: { id: courseEnrollmentId },
      include: { course: { include: { domain: true } } },
    });
    if (enrollment.status !== EnrollmentStatus.COMPLETED) {
      throw new Error('Course enrollment must be completed to issue certificate');
    }

    if (!enrollment.course.domainId || !enrollment.course.domain) {
      throw new Error('Course must belong to a domain to issue certificate');
    }

    const tenantId = enrollment.course.tenantId;
    if (!tenantId) {
      throw new Error('Course must belong to a tenant to issue certificate');
    }

    const template = await this.domainsService.ensureCertificateTemplate(
      tenantId,
      enrollment.course.domainId,
      enrollment.course.domain.color,
      enrollment.course.domain.name,
    );
    const verifyCode = `CC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    return this.prisma.issuedCertificate.create({
      data: {
        templateId: template.id,
        courseEnrollmentId,
        verifyCode,
        grade: (grade as 'PASS' | 'MERIT' | 'DISTINCTION') ?? undefined,
      },
    });
  }

  /** Verify certificate by code */
  async verifyCertificate(verifyCode: string) {
    return this.prisma.issuedCertificate.findUnique({
      where: { verifyCode },
      include: {
        enrollment: { include: { path: { include: { domain: true } } } },
        courseEnrollment: { include: { course: { include: { domain: true } } } },
        template: { include: { domain: true } },
      },
    });
  }

  /** Get user's certificates with full details (path + course) */
  async getUserCertificates(userId: string) {
    const [pathEnrollments, courseEnrollments] = await Promise.all([
      this.prisma.pathEnrollment.findMany({
        where: { userId, status: EnrollmentStatus.COMPLETED },
      }),
      this.prisma.courseEnrollment.findMany({
        where: { userId, status: EnrollmentStatus.COMPLETED },
      }),
    ]);

    const pathIds = pathEnrollments.map((e) => e.id);
    const courseIds = courseEnrollments.map((e) => e.id);

    return this.prisma.issuedCertificate.findMany({
      where: {
        OR: [
          ...(pathIds.length > 0 ? [{ enrollmentId: { in: pathIds } }] : []),
          ...(courseIds.length > 0 ? [{ courseEnrollmentId: { in: courseIds } }] : []),
        ],
      },
      include: {
        template: { include: { domain: true } },
        enrollment: {
          include: {
            path: { include: { domain: true, _count: { select: { steps: true } } } },
          },
        },
        courseEnrollment: {
          include: {
            course: {
              include: {
                domain: true,
                _count: { select: { courseSections: true } },
              },
            },
          },
        },
      },
      orderBy: { issuedAt: 'desc' },
    });
  }

  /** Get single certificate with all data needed for PDF rendering */
  async getCertificateDetail(certId: string) {
    const cert = await this.prisma.issuedCertificate.findUniqueOrThrow({
      where: { id: certId },
      include: {
        template: { include: { domain: true } },
        enrollment: {
          include: {
            path: {
              include: {
                domain: true,
                steps: { select: { id: true } },
              },
            },
          },
        },
        courseEnrollment: {
          include: {
            course: {
              include: {
                domain: true,
                courseSections: {
                  include: { items: { select: { id: true } } },
                },
              },
            },
          },
        },
      },
    });

    const userId = cert.enrollment?.userId ?? cert.courseEnrollment?.userId;
    const user = userId
      ? await this.prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, name: true, email: true },
        })
      : null;

    let totalLearningMinutes = 0;
    if (cert.enrollmentId) {
      const totalHours = await this.prisma.pathStepProgress.aggregate({
        where: { enrollmentId: cert.enrollmentId },
        _sum: { timeSpent: true },
      });
      totalLearningMinutes = totalHours._sum.timeSpent ?? 0;
    } else if (cert.courseEnrollmentId) {
      const totalHours = await this.prisma.courseSectionItemProgress.aggregate({
        where: { enrollmentId: cert.courseEnrollmentId },
        _sum: { timeSpent: true },
      });
      totalLearningMinutes = totalHours._sum.timeSpent ?? 0;
    }

    return {
      ...cert,
      user,
      totalLearningMinutes,
      certType: cert.enrollmentId ? 'path' : 'course',
    };
  }

  /** Get templates by domain (for admin) */
  async getTemplatesByDomain(domainId: string) {
    return this.prisma.certificateTemplate.findMany({
      where: { domainId },
      include: { domain: true },
    });
  }

  /** Get all templates for a tenant — auto-creates missing templates for active domains */
  async getAllTemplatesForTenant(tenantId: string) {
    const activeDomains = await this.prisma.domain.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    await Promise.all(
      activeDomains.map((d) =>
        this.domainsService.ensureCertificateTemplate(tenantId, d.id, d.color, d.name),
      ),
    );

    return this.prisma.certificateTemplate.findMany({
      where: { tenantId },
      include: { domain: true },
      orderBy: { domain: { sortOrder: 'asc' } },
    });
  }

  /** Get template for domain (single, for issuance) */
  async getTemplateForDomain(tenantId: string, domainId: string) {
    return this.prisma.certificateTemplate.findUnique({
      where: {
        tenantId_domainId: { tenantId, domainId },
      },
      include: { domain: true },
    });
  }

  /** Update template design (admin) */
  async updateTemplate(
    id: string,
    dto: {
      templateName?: string;
      themeConfig?: Record<string, unknown>;
      elementsConfig?: Record<string, unknown>;
      signatories?: Array<{ name: string; title: string }>;
    },
  ) {
    return this.prisma.certificateTemplate.update({
      where: { id },
      data: {
        ...(dto.templateName != null && { templateName: dto.templateName }),
        ...(dto.themeConfig != null && { themeConfig: dto.themeConfig as Prisma.InputJsonValue }),
        ...(dto.elementsConfig != null && { elementsConfig: dto.elementsConfig as Prisma.InputJsonValue }),
        ...(dto.signatories != null && { signatories: dto.signatories as Prisma.InputJsonValue }),
      },
      include: { domain: true },
    });
  }
}
