import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Learning Path CRUD — Full create, read, update, delete
 * omnilearn.space | Afflatus Consulting Group
 */

export interface CreatePathDto {
  tenantId: string;
  domainId: string;
  name: string;
  slug: string;
  difficulty?: string;
  description?: string;
  isPublished?: boolean;
  availablePlans?: string[];
  availableInEnterprise?: boolean;
  enterpriseTenantIds?: string[];
}

export interface CreateStepDto {
  pathId: string;
  contentItemId: string;
  stepOrder: number;
  isRequired?: boolean;
  unlockAfterId?: string;
  timeGateHours?: number;
}

@Injectable()
export class LearningPathCrudService {
  constructor(private readonly prisma: PrismaService) {}

  async createPath(data: CreatePathDto) {
    return this.prisma.learningPath.create({
      data: {
        tenantId: data.tenantId,
        domainId: data.domainId,
        name: data.name,
        slug: data.slug,
        difficulty: data.difficulty,
        description: data.description,
        isPublished: data.isPublished ?? false,
        availablePlans: data.availablePlans ?? ['EXPLORER', 'SPECIALIST', 'VISIONARY', 'NEXUS'],
        availableInEnterprise: data.availableInEnterprise ?? false,
      },
    });
  }

  async getPath(id: string) {
    return this.prisma.learningPath.findUniqueOrThrow({
      where: { id },
      include: {
        domain: true,
        steps: { orderBy: { stepOrder: 'asc' }, include: { contentItem: true } },
        _count: { select: { enrollments: true } },
      },
    });
  }

  async listPaths(tenantId?: string, domainId?: string, includeDraft = false) {
    return this.prisma.learningPath.findMany({
      where: {
        ...(tenantId && { tenantId }),
        ...(domainId && { domainId }),
        ...(!includeDraft && { isPublished: true }),
      },
      include: {
        domain: true,
        _count: { select: { steps: true, enrollments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updatePath(id: string, data: Partial<CreatePathDto>) {
    return this.prisma.learningPath.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.slug && { slug: data.slug }),
        ...(data.domainId && { domainId: data.domainId }),
        ...(data.difficulty !== undefined && { difficulty: data.difficulty }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.isPublished !== undefined && { isPublished: data.isPublished }),
        ...(data.availablePlans !== undefined && { availablePlans: data.availablePlans }),
        ...(data.availableInEnterprise !== undefined && { availableInEnterprise: data.availableInEnterprise }),
      },
    });
  }

  async deletePath(id: string) {
    return this.prisma.learningPath.delete({ where: { id } });
  }

  async addStep(data: CreateStepDto) {
    return this.prisma.learningPathStep.create({
      data: {
        pathId: data.pathId,
        contentItemId: data.contentItemId,
        stepOrder: data.stepOrder,
        isRequired: data.isRequired ?? true,
        unlockAfterId: data.unlockAfterId,
        timeGateHours: data.timeGateHours,
      },
      include: { contentItem: true },
    });
  }

  async updateStep(stepId: string, data: Partial<CreateStepDto>) {
    return this.prisma.learningPathStep.update({
      where: { id: stepId },
      data: {
        ...(data.contentItemId && { contentItemId: data.contentItemId }),
        ...(data.stepOrder !== undefined && { stepOrder: data.stepOrder }),
        ...(data.isRequired !== undefined && { isRequired: data.isRequired }),
        ...(data.unlockAfterId !== undefined && { unlockAfterId: data.unlockAfterId }),
        ...(data.timeGateHours !== undefined && { timeGateHours: data.timeGateHours }),
      },
    });
  }

  async removeStep(stepId: string) {
    return this.prisma.learningPathStep.delete({ where: { id: stepId } });
  }

  async replaceSteps(pathId: string, steps: Omit<CreateStepDto, 'pathId'>[]) {
    return this.prisma.$transaction(async (tx) => {
      await tx.learningPathStep.deleteMany({ where: { pathId } });
      if (steps.length === 0) return [];
      return Promise.all(
        steps.map((step) =>
          tx.learningPathStep.create({
            data: {
              pathId,
              contentItemId: step.contentItemId,
              stepOrder: step.stepOrder,
              isRequired: step.isRequired ?? true,
              unlockAfterId: step.unlockAfterId,
              timeGateHours: step.timeGateHours,
            },
            include: { contentItem: true },
          }),
        ),
      );
    });
  }
}
