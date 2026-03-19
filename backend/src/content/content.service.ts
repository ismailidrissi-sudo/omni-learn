import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../subscription/access.service';

/**
 * Content Service — Course builder, SCORM/xAPI metadata, tier-based access
 * omnilearn.space | Afflatus Consulting Group
 */

export interface CreateContentDto {
  type: string;
  title: string;
  description?: string;
  domainId?: string;
  mediaId?: string;
  durationMinutes?: number;
  metadata?: Record<string, unknown>;
  /** When empty = all companies. When set = only these tenants. */
  tenantIds?: string[];
  /** When empty = all users. When set = only these users. */
  userIds?: string[];
  /** 0=Foundational, 1=Sector, 2=All-access */
  accessLevel?: number;
  /** Sector tag for Specialist tier (Biotech, Food Safety, AI, etc.) */
  sectorTag?: string;
  /** Tenant ID for Nexus private content */
  tenantId?: string;
  /** Tag for Explorer (Free) tier */
  isFoundational?: boolean;
  /** Which subscription plans can access this content */
  availablePlans?: string[];
  /** Whether this content is available in company white-label academies */
  availableInEnterprise?: boolean;
}

export interface ScormMetadata {
  scormPackageUrl?: string;
  xapiEndpoint?: string;
  sections?: Array<{ id: string; title: string; duration?: number }>;
  totalDuration?: number;
  version?: '1.2' | '2004';
}

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: AccessService,
  ) {}

  async create(data: CreateContentDto) {
    const metadata = data.metadata ?? {};
    const metadataVal =
      typeof metadata === 'string' ? JSON.parse(metadata || '{}') : metadata;
    const plans = data.availablePlans ?? ['EXPLORER', 'SPECIALIST', 'VISIONARY', 'NEXUS'];
    const content = await this.prisma.contentItem.create({
      data: {
        type: data.type as 'COURSE' | 'VIDEO' | 'MICRO_LEARNING' | 'PODCAST' | 'DOCUMENT' | 'IMPLEMENTATION_GUIDE' | 'QUIZ_ASSESSMENT' | 'GAME',
        title: data.title,
        description: data.description,
        domainId: data.domainId,
        mediaId: data.mediaId,
        durationMinutes: data.durationMinutes,
        metadata: metadataVal as object,
        accessLevel: data.accessLevel ?? 0,
        sectorTag: data.sectorTag,
        tenantId: data.tenantId,
        isFoundational: data.isFoundational ?? plans.includes('EXPLORER'),
        availablePlans: plans,
        availableInEnterprise: data.availableInEnterprise ?? false,
      },
    });
    await this.setAssignments(content.id, data.tenantIds ?? [], data.userIds ?? []);
    return this.prisma.contentItem.findUniqueOrThrow({
      where: { id: content.id },
      include: {
        domain: true,
        tenantAssignments: { include: { tenant: true } },
        userAssignments: { include: { user: true } },
      },
    });
  }

  /** Find all content with tier-based access filtering (adminMode skips filtering) */
  async findAll(type?: string, userId?: string | null, adminMode = false) {
    const typeFilter = type
      ? { type: type as 'COURSE' | 'VIDEO' | 'MICRO_LEARNING' | 'PODCAST' | 'DOCUMENT' | 'IMPLEMENTATION_GUIDE' | 'QUIZ_ASSESSMENT' | 'GAME' }
      : {};

    if (adminMode) {
      return this.prisma.contentItem.findMany({
        where: typeFilter,
        orderBy: { createdAt: 'desc' },
      });
    }

    const ctx = await this.accessService.getAccessContext(userId ?? null);
    const accessWhere = this.accessService.buildContentWhere(ctx);
    const where = type
      ? { AND: [typeFilter, accessWhere] }
      : accessWhere;
    return this.prisma.contentItem.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId?: string | null, adminMode = false) {
    const content = await this.prisma.contentItem.findUniqueOrThrow({
      where: { id },
      include: {
        domain: true,
        tenantAssignments: { include: { tenant: true } },
        userAssignments: { include: { user: true } },
      },
    });
    if (adminMode) {
      return { ...content, adsEnabled: false };
    }
    const ctx = await this.accessService.getAccessContext(userId ?? null);
    const canAccess = await this.accessService.canAccessContent(id, ctx);
    if (!canAccess) {
      throw new ForbiddenException('Access denied to this content');
    }
    return { ...content, adsEnabled: this.accessService.shouldShowAds(ctx) };
  }

  async update(id: string, data: Partial<CreateContentDto>) {
    const updateData: Record<string, unknown> = {};
    if (data.type) updateData.type = data.type;
    if (data.title) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.domainId !== undefined) updateData.domainId = data.domainId;
    if (data.mediaId !== undefined) updateData.mediaId = data.mediaId;
    if (data.durationMinutes !== undefined) updateData.durationMinutes = data.durationMinutes;
    if (data.metadata) {
      updateData.metadata = typeof data.metadata === 'string' ? data.metadata : JSON.stringify(data.metadata);
    }
    if (data.accessLevel !== undefined) updateData.accessLevel = data.accessLevel;
    if (data.sectorTag !== undefined) updateData.sectorTag = data.sectorTag;
    if (data.tenantId !== undefined) updateData.tenantId = data.tenantId || null;
    if (data.isFoundational !== undefined) updateData.isFoundational = data.isFoundational;
    if (data.availablePlans !== undefined) {
      updateData.availablePlans = data.availablePlans;
      updateData.isFoundational = data.availablePlans.includes('EXPLORER');
    }
    if (data.availableInEnterprise !== undefined) updateData.availableInEnterprise = data.availableInEnterprise;
    await this.prisma.contentItem.update({
      where: { id },
      data: updateData,
    });
    if (data.tenantIds !== undefined || data.userIds !== undefined) {
      await this.setAssignments(
        id,
        data.tenantIds ?? (await this.getTenantIds(id)),
        data.userIds ?? (await this.getUserIds(id)),
      );
    }
    return this.findOne(id);
  }

  private async setAssignments(contentId: string, tenantIds: string[], userIds: string[]) {
    await this.prisma.contentTenantAssignment.deleteMany({ where: { contentId } });
    await this.prisma.contentUserAssignment.deleteMany({ where: { contentId } });
    if (tenantIds.length > 0) {
      await this.prisma.contentTenantAssignment.createMany({
        data: tenantIds.map((tenantId) => ({ contentId, tenantId })),
      });
    }
    if (userIds.length > 0) {
      await this.prisma.contentUserAssignment.createMany({
        data: userIds.map((userId) => ({ contentId, userId })),
      });
    }
  }

  private async getTenantIds(contentId: string): Promise<string[]> {
    const rows = await this.prisma.contentTenantAssignment.findMany({
      where: { contentId },
      select: { tenantId: true },
    });
    return rows.map((r) => r.tenantId);
  }

  private async getUserIds(contentId: string): Promise<string[]> {
    const rows = await this.prisma.contentUserAssignment.findMany({
      where: { contentId },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  }

  async remove(id: string) {
    return this.prisma.contentItem.delete({
      where: { id },
    });
  }

  /** Create COURSE content with SCORM metadata */
  async createCourse(
    title: string,
    scormMetadata: ScormMetadata,
    durationMinutes?: number,
    opts?: {
      description?: string;
      domainId?: string;
      tenantIds?: string[];
      userIds?: string[];
      isFoundational?: boolean;
      availablePlans?: string[];
      availableInEnterprise?: boolean;
    },
  ) {
    return this.create({
      type: 'COURSE',
      title,
      description: opts?.description,
      domainId: opts?.domainId,
      durationMinutes: durationMinutes ?? scormMetadata.totalDuration,
      metadata: scormMetadata as unknown as Record<string, unknown>,
      tenantIds: opts?.tenantIds,
      userIds: opts?.userIds,
      isFoundational: opts?.isFoundational,
      availablePlans: opts?.availablePlans,
      availableInEnterprise: opts?.availableInEnterprise,
    });
  }
}
