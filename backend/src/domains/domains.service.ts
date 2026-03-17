import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Domains Service — Dynamic domains (admin-created, NOT enums)
 * omnilearn.space | Afflatus Consulting Group
 * Architecture: Section 5 — Domains are database entities, not hardcoded constants.
 */

export interface CreateDomainDto {
  tenantId: string;
  name: string;
  slug?: string;
  description?: string;
  icon?: string;
  color: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateDomainDto {
  name?: string;
  slug?: string;
  description?: string;
  icon?: string;
  color?: string;
  isActive?: boolean;
  sortOrder?: number;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class DomainsService {
  constructor(private readonly prisma: PrismaService) {}

  /** List domains for a tenant (optionally active only). When tenantId is empty, list all domains (admin). */
  async list(tenantId?: string, activeOnly = true) {
    return this.prisma.domain.findMany({
      where: {
        ...(tenantId && { tenantId }),
        ...(activeOnly && { isActive: true }),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        _count: {
          select: { learningPaths: true, contentItems: true },
        },
      },
    });
  }

  /** Get domain by ID */
  async getById(id: string) {
    return this.prisma.domain.findUniqueOrThrow({
      where: { id },
      include: {
        certificateTemplate: true,
        _count: {
          select: { learningPaths: true, contentItems: true },
        },
      },
    });
  }

  /** Get domain by slug within tenant */
  async getBySlug(tenantId: string, slug: string) {
    return this.prisma.domain.findFirstOrThrow({
      where: { tenantId, slug },
    });
  }

  /** Create domain and auto-create certificate template */
  async create(dto: CreateDomainDto) {
    const slug = dto.slug ?? this.slugFromName(dto.name);
    const domain = await this.prisma.domain.create({
      data: {
        tenantId: dto.tenantId,
        name: dto.name,
        slug,
        description: dto.description,
        icon: dto.icon,
        color: dto.color,
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
    await this.ensureCertificateTemplate(domain.tenantId, domain.id, domain.color, domain.name);
    return this.getById(domain.id);
  }

  /** Update domain */
  async update(id: string, dto: UpdateDomainDto) {
    return this.prisma.domain.update({
      where: { id },
      data: {
        ...(dto.name != null && { name: dto.name }),
        ...(dto.slug != null && { slug: dto.slug }),
        ...(dto.description != null && { description: dto.description }),
        ...(dto.icon != null && { icon: dto.icon }),
        ...(dto.color != null && { color: dto.color }),
        ...(dto.isActive != null && { isActive: dto.isActive }),
        ...(dto.sortOrder != null && { sortOrder: dto.sortOrder }),
        ...(dto.metadata != null && { metadata: dto.metadata as Prisma.InputJsonValue }),
      },
    });
  }

  /** Toggle domain active state */
  async toggleActive(id: string, active: boolean) {
    return this.prisma.domain.update({
      where: { id },
      data: { isActive: active },
    });
  }

  /** Delete domain (cascades to certificate template) */
  async delete(id: string) {
    return this.prisma.domain.delete({
      where: { id },
    });
  }

  /** Ensure certificate template exists for domain (auto-created per architecture) */
  async ensureCertificateTemplate(
    tenantId: string,
    domainId: string,
    _primaryColor?: string,
    _domainName?: string,
  ) {
    const domain = await this.prisma.domain.findUniqueOrThrow({
      where: { id: domainId },
    });
    const existing = await this.prisma.certificateTemplate.findUnique({
      where: {
        tenantId_domainId: { tenantId, domainId },
      },
    });
    if (existing) return existing;

    const primaryColor = _primaryColor || domain.color;
    const secondaryColor = this.lightenColor(primaryColor, 15);
    return this.prisma.certificateTemplate.create({
      data: {
        tenantId,
        domainId,
        templateName: `${domain.name} Certificate`,
        themeConfig: {
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          accent_color: '#c8a951',
          seal_text: `CERTIFIED ${(domain.name).toUpperCase().replace(/\s+/g, ' ')} PROFESSIONAL`,
          title_font: 'Playfair Display',
          body_font: 'Source Serif 4',
        },
        elementsConfig: {
          show_logo: true,
          show_qr: true,
          show_hours: true,
          show_grade: true,
          show_signature: true,
          show_seal: true,
          show_expiry: false,
          show_badge: false,
        },
        signatories: [],
      },
    });
  }

  private slugFromName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private lightenColor(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, ((num >> 16) & 0xff) + ((255 - ((num >> 16) & 0xff)) * percent) / 100);
    const g = Math.min(255, ((num >> 8) & 0xff) + ((255 - ((num >> 8) & 0xff)) * percent) / 100);
    const b = Math.min(255, (num & 0xff) + ((255 - (num & 0xff)) * percent) / 100);
    return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
  }
}
