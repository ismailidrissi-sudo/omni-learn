import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Domain, Prisma } from '@prisma/client';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, relative, resolve } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { DomainsService } from '../domains/domains.service';
import { EnrollmentStatus } from '../constants/db.constant';
import { CertificatePdfService } from './certificate-pdf.service';
import { CertificateUrlService } from './certificate-url.service';

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
    private readonly certificateUrlService: CertificateUrlService,
  ) {}

  private get storagePath(): string {
    return process.env.CERTIFICATE_STORAGE_PATH || './data/certificates';
  }

  private async generateAndStorePdf(
    certificateId: string,
    data: import('./certificate-pdf.service').CertificatePdfData,
  ): Promise<string> {
    const year = data.completionDate.getFullYear().toString();
    const month = String(data.completionDate.getMonth() + 1).padStart(2, '0');
    const dir = join(this.storagePath, year, month);
    mkdirSync(dir, { recursive: true });

    const pdfBuffer = await this.certificatePdfService.generatePdf(data);

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

  /** Reject path traversal when resolving pdfUrl from the database. */
  private absolutePdfUnderStorage(pdfUrlRelative: string): string | null {
    const trimmed = pdfUrlRelative.trim();
    if (!trimmed) return null;
    const root = resolve(this.storagePath);
    const candidate = resolve(root, trimmed);
    const rel = relative(root, candidate);
    if (!rel || rel.startsWith('..')) return null;
    return candidate;
  }

  /**
   * Resolve the certificate PDF on disk for signed downloads: use stored pdfUrl when present,
   * else the YYYY/MM/{id}.pdf layout from issuedAt. If the file is missing, regenerate it
   * (covers failed issuance PDF step, ephemeral server storage, or manual data fixes).
   */
  async ensureCertificatePdfAbsolutePath(certificateId: string): Promise<string> {
    const cert = await this.prisma.issuedCertificate.findUnique({
      where: { id: certificateId },
      include: {
        enrollment: { include: { path: true } },
        courseEnrollment: { include: { course: true } },
      },
    });

    if (!cert) {
      throw new NotFoundException('Certificate not found');
    }

    if (cert.pdfUrl) {
      const fromDb = this.absolutePdfUnderStorage(cert.pdfUrl);
      if (fromDb && existsSync(fromDb)) {
        return fromDb;
      }
    }

    const issuedAt = cert.issuedAt;
    const year = issuedAt.getFullYear().toString();
    const month = String(issuedAt.getMonth() + 1).padStart(2, '0');
    const byIssuedAt = join(this.storagePath, year, month, `${certificateId}.pdf`);
    if (existsSync(byIssuedAt)) {
      return byIssuedAt;
    }

    this.logger.warn(
      `Certificate PDF missing for ${certificateId}; regenerating (pdfUrl=${cert.pdfUrl ?? 'null'})`,
    );

    const userId = cert.enrollment?.userId ?? cert.courseEnrollment?.userId;
    const user = userId
      ? await this.prisma.user.findUnique({
          where: { id: userId },
          select: { name: true },
        })
      : null;

    let contentTitle: string;
    let contentType: 'course' | 'path';
    let tenantId: string | null | undefined;
    let domainName: string | undefined;

    if (cert.courseEnrollment) {
      contentTitle = cert.courseEnrollment.course.title;
      contentType = 'course';
      tenantId = cert.courseEnrollment.course.tenantId;
    } else if (cert.enrollment) {
      contentTitle = cert.enrollment.path.name;
      contentType = 'path';
      tenantId = cert.enrollment.path.tenantId;
    } else {
      throw new NotFoundException('Certificate PDF not found');
    }

    const template = cert.templateId
      ? await this.prisma.certificateTemplate.findUnique({
          where: { id: cert.templateId },
          include: { domain: true },
        })
      : null;
    domainName = template?.domain?.name;

    let totalLearningMinutes = 0;
    if (cert.enrollmentId) {
      const agg = await this.prisma.pathStepProgress.aggregate({
        where: { enrollmentId: cert.enrollmentId },
        _sum: { timeSpent: true },
      });
      totalLearningMinutes = agg._sum.timeSpent ?? 0;
    } else if (cert.courseEnrollmentId) {
      const agg = await this.prisma.courseSectionItemProgress.aggregate({
        where: { enrollmentId: cert.courseEnrollmentId },
        _sum: { timeSpent: true },
      });
      totalLearningMinutes = agg._sum.timeSpent ?? 0;
    }

    const tenant = tenantId
      ? await this.prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { name: true },
        })
      : null;

    const relativePath = await this.generateAndStorePdf(certificateId, {
      userName: user?.name || 'Learner',
      contentTitle,
      contentType,
      completionDate: cert.issuedAt,
      verifyCode: cert.verifyCode,
      tenantId,
      domainName,
      grade: cert.grade,
      totalLearningMinutes,
      tenantName: tenant?.name,
      themeConfig: template?.themeConfig as Record<string, unknown> | null,
      elementsConfig: template?.elementsConfig as Record<string, unknown> | null,
      signatories: template?.signatories as Array<{ name: string; title: string }> | null,
    });

    return join(this.storagePath, relativePath);
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

      let totalLearningMinutes = 0;
      const agg = await this.prisma.pathStepProgress.aggregate({
        where: { enrollmentId: enrollment.id },
        _sum: { timeSpent: true },
      });
      totalLearningMinutes = agg._sum.timeSpent ?? 0;

      const tenant = await this.prisma.tenant.findUnique({
        where: { id: enrollment.path.tenantId },
        select: { name: true },
      });

      await this.generateAndStorePdf(cert.id, {
        userName: user?.name || 'Learner',
        contentTitle: enrollment.path.name,
        contentType: 'path',
        completionDate: cert.issuedAt,
        verifyCode,
        tenantId: enrollment.path.tenantId,
        domainName: enrollment.path.domain.name,
        grade: grade ?? null,
        totalLearningMinutes,
        tenantName: tenant?.name,
        themeConfig: template.themeConfig as Record<string, unknown> | null,
        elementsConfig: template.elementsConfig as Record<string, unknown> | null,
        signatories: template.signatories as Array<{ name: string; title: string }> | null,
      });
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

      let totalLearningMinutes = 0;
      const agg = await this.prisma.courseSectionItemProgress.aggregate({
        where: { enrollmentId: courseEnrollmentId },
        _sum: { timeSpent: true },
      });
      totalLearningMinutes = agg._sum.timeSpent ?? 0;

      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      });

      await this.generateAndStorePdf(cert.id, {
        userName: user?.name || 'Learner',
        contentTitle: enrollment.course.title,
        contentType: 'course',
        completionDate: cert.issuedAt,
        verifyCode,
        tenantId,
        domainName: domain.name,
        grade: grade ?? null,
        totalLearningMinutes,
        tenantName: tenant?.name,
        themeConfig: template.themeConfig as Record<string, unknown> | null,
        elementsConfig: template.elementsConfig as Record<string, unknown> | null,
        signatories: template.signatories as Array<{ name: string; title: string }> | null,
      });
    } catch (err) {
      this.logger.error(`Failed to generate PDF for course certificate ${cert.id}: ${err}`);
    }

    return cert;
  }

  private parseJsonRecord(raw: unknown): Record<string, unknown> {
    if (raw == null) return {};
    if (typeof raw === 'object' && !Array.isArray(raw)) {
      return raw as Record<string, unknown>;
    }
    if (typeof raw === 'string') {
      try {
        const v = JSON.parse(raw) as unknown;
        return typeof v === 'object' && v !== null && !Array.isArray(v)
          ? (v as Record<string, unknown>)
          : {};
      } catch {
        return {};
      }
    }
    return {};
  }

  /** Strip HTML / collapse whitespace for public description text */
  private plainTextDescription(html: string | null | undefined): string | null {
    if (html == null || !String(html).trim()) return null;
    const stripped = String(html)
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return stripped || null;
  }

  /**
   * Public verification payload for /certificates/verify/:code — no internal user ids or emails.
   * Signed PDF URLs expire after 1 day.
   */
  async getPublicVerificationByCode(verifyCode: string) {
    const cert = await this.prisma.issuedCertificate.findUnique({
      where: { verifyCode },
      include: {
        enrollment: {
          include: {
            path: {
              include: {
                domain: true,
                steps: {
                  orderBy: { stepOrder: 'asc' },
                  include: {
                    contentItem: {
                      select: { durationMinutes: true, metadata: true, title: true },
                    },
                  },
                },
              },
            },
          },
        },
        courseEnrollment: {
          include: {
            course: {
              select: {
                title: true,
                description: true,
                durationMinutes: true,
                metadata: true,
                domain: true,
                courseSections: {
                  select: {
                    items: {
                      select: {
                        durationMinutes: true,
                        videoDurationSeconds: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        template: { include: { domain: true } },
      },
    });

    if (!cert) return null;

    const userId = cert.enrollment?.userId ?? cert.courseEnrollment?.userId;
    const user = userId
      ? await this.prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, trainerProfile: { select: { photoUrl: true } } },
        })
      : null;

    const recipientName = user?.name ?? 'Learner';
    const recipientImageUrl = user?.trainerProfile?.photoUrl ?? null;

    let certType: 'course' | 'path';
    let title: string;
    let description: string | null;
    let domainName: string | null;
    let thumbnailUrl: string | null;
    let contentCount: number;
    let durationMinutes: number | null;

    if (cert.courseEnrollment) {
      certType = 'course';
      const course = cert.courseEnrollment.course;
      title = course.title;
      description = this.plainTextDescription(course.description);
      domainName = course.domain?.name ?? null;
      const meta = this.parseJsonRecord(course.metadata);
      const landing = meta.landingPage as Record<string, unknown> | undefined;
      thumbnailUrl =
        typeof landing?.thumbnailUrl === 'string' ? landing.thumbnailUrl : null;

      let count = 0;
      let sumMins = 0;
      for (const sec of course.courseSections) {
        count += sec.items.length;
        for (const item of sec.items) {
          const dm = item.durationMinutes ?? 0;
          const vs = item.videoDurationSeconds
            ? Math.ceil(item.videoDurationSeconds / 60)
            : 0;
          sumMins += dm || vs;
        }
      }
      contentCount = count;
      durationMinutes =
        course.durationMinutes != null && course.durationMinutes > 0
          ? course.durationMinutes
          : sumMins > 0
            ? sumMins
            : null;
    } else if (cert.enrollment) {
      certType = 'path';
      const path = cert.enrollment.path;
      title = path.name;
      description = this.plainTextDescription(path.description);
      domainName = path.domain?.name ?? null;
      const steps = path.steps;
      contentCount = steps.length;
      let sumMins = 0;
      for (const st of steps) {
        const dm = st.contentItem.durationMinutes;
        if (dm != null && dm > 0) sumMins += dm;
      }
      durationMinutes = sumMins > 0 ? sumMins : null;
      thumbnailUrl = null;
      const first = steps[0]?.contentItem;
      if (first) {
        const meta = this.parseJsonRecord(first.metadata);
        const landing = meta.landingPage as Record<string, unknown> | undefined;
        thumbnailUrl =
          typeof landing?.thumbnailUrl === 'string' ? landing.thumbnailUrl : null;
      }
    } else {
      return null;
    }

    const signed = this.certificateUrlService.generateSignedUrl(cert.id, 1);
    const pdfPreviewUrl = signed.url;
    const pdfDownloadUrl = `${signed.url}&attachment=1`;

    return {
      verifyCode: cert.verifyCode,
      grade: cert.grade,
      issuedAt: cert.issuedAt.toISOString(),
      certType,
      templateName: cert.template?.templateName ?? null,
      recipientName,
      recipientImageUrl,
      title,
      description,
      domainName,
      thumbnailUrl,
      contentCount,
      durationMinutes,
      pdfPreviewUrl,
      pdfDownloadUrl,
    };
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

    const certs = await this.prisma.issuedCertificate.findMany({
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

    return certs.map((cert) => {
      const signed = this.certificateUrlService.generateSignedUrl(cert.id, 30);
      return {
        ...cert,
        pdfDownloadUrl: `${signed.url}&attachment=1`,
      };
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

    const signed = this.certificateUrlService.generateSignedUrl(cert.id, 30);
    return {
      ...cert,
      user,
      totalLearningMinutes,
      certType: cert.enrollmentId ? 'path' : 'course',
      pdfDownloadUrl: `${signed.url}&attachment=1`,
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
