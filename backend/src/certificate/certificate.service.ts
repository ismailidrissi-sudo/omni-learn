import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DomainsService } from '../domains/domains.service';
import { EnrollmentStatus } from '../constants/db.constant';

/**
 * Certificate Service — Progress tracking + certificate issuance
 * Domain-themed templates (from Domain entity, NOT hardcoded) | omnilearn.space | Afflatus Consulting Group
 */

@Injectable()
export class CertificateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly domainsService: DomainsService,
  ) {}

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

  /** Verify certificate by code */
  async verifyCertificate(verifyCode: string) {
    return this.prisma.issuedCertificate.findUnique({
      where: { verifyCode },
      include: {
        enrollment: { include: { path: { include: { domain: true } } } },
        template: { include: { domain: true } },
      },
    });
  }

  /** Get user's certificates */
  async getUserCertificates(userId: string) {
    const enrollments = await this.prisma.pathEnrollment.findMany({
      where: { userId, status: EnrollmentStatus.COMPLETED },
      include: { path: { include: { domain: true } } },
    });
    return this.prisma.issuedCertificate.findMany({
      where: { enrollmentId: { in: enrollments.map((e) => e.id) } },
      include: { template: { include: { domain: true } } },
    });
  }

  /** Get templates by domain (for admin) */
  async getTemplatesByDomain(domainId: string) {
    return this.prisma.certificateTemplate.findMany({
      where: { domainId },
      include: { domain: true },
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
}
