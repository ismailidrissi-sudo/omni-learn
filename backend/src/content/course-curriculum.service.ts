import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RbacRole } from '../constants/rbac.constant';

export interface CreateSectionDto {
  courseId: string;
  title: string;
  learningGoal?: string;
  sortOrder?: number;
}

export interface UpdateSectionDto {
  title?: string;
  learningGoal?: string;
  sortOrder?: number;
}

export interface CreateSectionItemDto {
  sectionId: string;
  itemType: string;
  title: string;
  sortOrder?: number;
  durationMinutes?: number;
  contentUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateSectionItemDto {
  title?: string;
  sortOrder?: number;
  durationMinutes?: number;
  contentUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
}

export type CurriculumEditor = { userId: string; roles: string[] };

function canBypassCurriculumOwnership(roles: string[]): boolean {
  return roles.includes(RbacRole.SUPER_ADMIN) || roles.includes(RbacRole.COMPANY_ADMIN);
}

@Injectable()
export class CourseCurriculumService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertCanMutateCourse(courseId: string, editor: CurriculumEditor) {
    if (canBypassCurriculumOwnership(editor.roles)) return;
    const course = await this.prisma.contentItem.findUnique({
      where: { id: courseId },
      select: { createdById: true },
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }
    if (!course.createdById || course.createdById !== editor.userId) {
      throw new ForbiddenException('You can only modify curriculum of courses you created');
    }
  }

  private async resolveCourseIdFromSection(sectionId: string): Promise<string> {
    const section = await this.prisma.courseSection.findUnique({
      where: { id: sectionId },
      select: { courseId: true },
    });
    if (!section) {
      throw new NotFoundException('Section not found');
    }
    return section.courseId;
  }

  private async resolveCourseIdFromSectionItem(itemId: string): Promise<string> {
    const item = await this.prisma.courseSectionItem.findUnique({
      where: { id: itemId },
      select: { section: { select: { courseId: true } } },
    });
    if (!item) {
      throw new NotFoundException('Section item not found');
    }
    return item.section.courseId;
  }

  async getCourseCurriculum(courseId: string) {
    return this.prisma.courseSection.findMany({
      where: { courseId },
      orderBy: { sortOrder: 'asc' },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
  }

  async createSection(data: CreateSectionDto, editor: CurriculumEditor) {
    await this.assertCanMutateCourse(data.courseId, editor);
    const maxOrder = await this.prisma.courseSection
      .aggregate({
        where: { courseId: data.courseId },
        _max: { sortOrder: true },
      })
      .then((r) => r._max.sortOrder ?? -1);
    return this.prisma.courseSection.create({
      data: {
        courseId: data.courseId,
        title: data.title,
        learningGoal: data.learningGoal,
        sortOrder: data.sortOrder ?? maxOrder + 1,
      },
    });
  }

  async updateSection(sectionId: string, data: UpdateSectionDto, editor: CurriculumEditor) {
    const courseId = await this.resolveCourseIdFromSection(sectionId);
    await this.assertCanMutateCourse(courseId, editor);
    return this.prisma.courseSection.update({
      where: { id: sectionId },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.learningGoal !== undefined && { learningGoal: data.learningGoal }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      },
    });
  }

  async deleteSection(sectionId: string, editor: CurriculumEditor) {
    const courseId = await this.resolveCourseIdFromSection(sectionId);
    await this.assertCanMutateCourse(courseId, editor);
    return this.prisma.courseSection.delete({
      where: { id: sectionId },
    });
  }

  async createSectionItem(data: CreateSectionItemDto, editor: CurriculumEditor) {
    const courseId = await this.resolveCourseIdFromSection(data.sectionId);
    await this.assertCanMutateCourse(courseId, editor);
    const maxOrder = await this.prisma.courseSectionItem
      .aggregate({
        where: { sectionId: data.sectionId },
        _max: { sortOrder: true },
      })
      .then((r) => r._max.sortOrder ?? -1);
    const metadata =
      data.metadata != null
        ? (typeof data.metadata === 'object' ? data.metadata : JSON.parse(String(data.metadata)))
        : undefined;
    return this.prisma.courseSectionItem.create({
      data: {
        sectionId: data.sectionId,
        itemType: data.itemType as 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'QUIZ' | 'ARTICLE' | 'CODING_EXERCISE',
        title: data.title,
        sortOrder: data.sortOrder ?? maxOrder + 1,
        durationMinutes: data.durationMinutes,
        contentUrl: data.contentUrl,
        metadata: metadata ? JSON.stringify(metadata) : undefined,
      },
    });
  }

  async updateSectionItem(itemId: string, data: UpdateSectionItemDto, editor: CurriculumEditor) {
    const courseId = await this.resolveCourseIdFromSectionItem(itemId);
    await this.assertCanMutateCourse(courseId, editor);
    const updateData: Record<string, unknown> = {};
    if (data.title) updateData.title = data.title;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
    if (data.durationMinutes !== undefined) updateData.durationMinutes = data.durationMinutes;
    if (data.contentUrl !== undefined) updateData.contentUrl = data.contentUrl;
    if (data.metadata !== undefined) {
      updateData.metadata =
        typeof data.metadata === 'object' ? data.metadata : JSON.parse(String(data.metadata));
    }
    return this.prisma.courseSectionItem.update({
      where: { id: itemId },
      data: updateData as never,
    });
  }

  async deleteSectionItem(itemId: string, editor: CurriculumEditor) {
    const courseId = await this.resolveCourseIdFromSectionItem(itemId);
    await this.assertCanMutateCourse(courseId, editor);
    return this.prisma.courseSectionItem.delete({
      where: { id: itemId },
    });
  }

  async reorderSections(courseId: string, sectionIds: string[], editor: CurriculumEditor) {
    await this.assertCanMutateCourse(courseId, editor);
    const updates = sectionIds.map((id, i) =>
      this.prisma.courseSection.update({
        where: { id },
        data: { sortOrder: i },
      }),
    );
    return this.prisma.$transaction(updates);
  }

  async reorderSectionItems(sectionId: string, itemIds: string[], editor: CurriculumEditor) {
    const courseId = await this.resolveCourseIdFromSection(sectionId);
    await this.assertCanMutateCourse(courseId, editor);
    const updates = itemIds.map((id, i) =>
      this.prisma.courseSectionItem.update({
        where: { id },
        data: { sortOrder: i },
      }),
    );
    return this.prisma.$transaction(updates);
  }
}
