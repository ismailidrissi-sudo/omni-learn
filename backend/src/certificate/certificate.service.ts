import { Injectable, Logger } from '@nestjs/common';
import { Domain, Prisma } from '@prisma/client';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { DomainsService } from '../domains/domains.service';
import { EnrollmentStatus } from '../constants/db.constant';
import { CertificatePdfService } from './certificate-pdf.service';

/**
 * Certificate Service — Progress tracking + certificate issuance
 * Domain-themed templates (from Domain entity, NOT hardcoded) | omnilearn.space | Afflatus Consulting Group
 */

@Injectable()
export class CertificateService {
  private readonly logger = new Logger(CertificateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly domainsService: DomainsService,
    private readonly certificatePdfService: CertificatePdfService,
  ) {}

  private get storagePath(): string {
    return process.env.CERTIFICATE_STORAGE_PATH || './data/certificates';
  }

  private async generateAndStorePdf(
    certificateId: string,
    userName: string,
    contentTitle: string,
    contentType: 'course' | 'path',
    completionDate: Date,
    verifyCode: string,
    tenantId?: string | null,
  ): Promise<string> {
    const year = completionDate.getFullYear().toString();
    const month = String(completionDate.getMonth() + 1).padStart(2, '0');
    const dir = join(this.storagePath, year, month);
    mkdirSync(dir, { recursive: true });

    const pdfBuffer = await this.certificatePdfService.generatePdf({
      userName,
      contentTitle,
      contentType,
      completionDate,
      verifyCode,
      tenantId,
    });

    const filePath = join(dir, `${certificateId}.pdf`);
    writeFileSync(filePath, pdfBuffer);

    const relativePath = join(year, month, `${certificateId}.pdf`);
    await this.prisma.issuedCertificate.update({
      where: { id: certificateId },
      data: { pdfUrl: relativePath },
    });

    this.logger.log(`PDF stored: ${filePath}`);
    return relativePath;
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

    const cert = await this.prisma.issuedCertificate.create({
      data: {
        templateId: template.id,
        enrollmentId,
        verifyCode,
        grade: (grade as 'PASS' | 'MERIT' | 'DISTINCTION') ?? undefined,
      },
    });

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: enrollment.userId },
        select: { name: true },
      });
      await this.generateAndStorePdf(
        cert.id,
        user?.name || 'Learner',
        enrollment.path.name,
        'path',
        cert.issuedAt,
        verifyCode,
        enrollment.path.tenantId,
      );
    } catch (err) {
      this.logger.error(`Failed to generate PDF for path certificate ${cert.id}: ${err}`);
    }

    return cert;
  }

  /**
   * Resolve tenant + domain for course certificates. ContentItem may omit tenantId/domainId;
   * we derive tenant from the domain row, content assignments, or the learner's tenant.
   */
  private async resolveCourseCertificateDomain(
    course: {
      id: string;
      tenantId: string | null;
      domainId: string | null;
      domain: Domain | null;
    },
    userId: string,
  ): Promise<{ tenantId: string; domain: Domain }> {
    if (course.domainId && course.domain) {
      const tenantId = course.tenantId ?? course.domain.tenantId;
      return { tenantId, domain: course.domain };
    }

    if (course.domainId) {
      const domain = await this.prisma.domain.findUniqueOrThrow({
        where: { id: course.domainId },
      });
      const tenantId = course.tenantId ?? domain.tenantId;
      return { tenantId, domain };
    }

    if (course.tenantId) {
      const domain = await this.prisma.domain.findFirst({
        where: { tenantId: course.tenantId, isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });
      if (domain) return { tenantId: course.tenantId, domain };
    }

    const assignment = await this.prisma.contentTenantAssignment.findFirst({
      where: { contentId: course.id },
      orderBy: { createdAt: 'asc' },
    });
    if (assignment) {
      const domain = await this.prisma.domain.findFirst({
        where: { tenantId: assignment.tenantId, isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });
      if (domain) return { tenantId: assignment.tenantId, domain };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { tenantId: true },
    });
    if (user?.tenantId) {
      const domain = await this.prisma.domain.findFirst({
        where: { tenantId: user.tenantId, isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });
      if (domain) return { tenantId: user.tenantId, domain };
    }

    const fallback = await this.prisma.domain.findFirst({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    if (!fallback) {
      throw new Error(
        'No certificate domain available — add a training domain in Admin (Domains)',
      );
    }
    this.logger.warn(
      `Course ${course.id} has no domain/tenant; using fallback domain ${fallback.id} for certificate`,
    );
    return { tenantId: fallback.tenantId, domain: fallback };
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

    const { tenantId, domain } = await this.resolveCourseCertificateDomain(
      enrollment.course,
      enrollment.userId,
    );

    const template = await this.domainsService.ensureCertificateTemplate(
      tenantId,
      domain.id,
      domain.color,
      domain.name,
    );
    const verifyCode = `CC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    const cert = await this.prisma.issuedCertificate.create({
      data: {
        templateId: template.id,
        courseEnrollmentId,
        verifyCode,
        grade: (grade as 'PASS' | 'MERIT' | 'DISTINCTION') ?? undefined,
      },
    });

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: enrollment.userId },
        select: { name: true },
      });
      await this.generateAndStorePdf(
        cert.id,
        user?.name || 'Learner',
        enrollment.course.title,
        'course',
        cert.issuedAt,
        verifyCode,
        tenantId,
      );
    } catch (err) {
      this.logger.error(`Failed to generate PDF for course certificate ${cert.id}: ${err}`);
    }

    return cert;
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

  /** Issue missing certificates for all completed enrollments (admin, on-demand only) */
  async backfillMissingCertificates() {
    let issued = 0;
    const errors: string[] = [];

    const completedPathEnrollments = await this.prisma.pathEnrollment.findMany({
      where: {
        status: EnrollmentStatus.COMPLETED,
        certificates: { none: {} },
      },
      select: { id: true },
    });

    for (const { id } of completedPathEnrollments) {
      try {
        await this.issueCertificate(id);
        issued++;
      } catch (err) {
        errors.push(`path:${id}: ${err}`);
      }
    }

    const completedCourseEnrollments = await this.prisma.courseEnrollment.findMany({
      where: {
        status: EnrollmentStatus.COMPLETED,
        certificates: { none: {} },
      },
      select: { id: true },
    });

    for (const { id } of completedCourseEnrollments) {
      try {
        await this.issueCourseEnrollmentCertificate(id);
        issued++;
      } catch (err) {
        errors.push(`course:${id}: ${err}`);
      }
    }

    this.logger.log(`Certificate backfill: ${issued} issued, ${errors.length} skipped`);
    return { issued, skipped: errors.length, errors };
  }
}
