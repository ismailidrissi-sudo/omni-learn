import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

@Injectable()
export class CourseCurriculumService {
  constructor(private readonly prisma: PrismaService) {}

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

  async createSection(data: CreateSectionDto) {
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

  async updateSection(sectionId: string, data: UpdateSectionDto) {
    return this.prisma.courseSection.update({
      where: { id: sectionId },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.learningGoal !== undefined && { learningGoal: data.learningGoal }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      },
    });
  }

  async deleteSection(sectionId: string) {
    return this.prisma.courseSection.delete({
      where: { id: sectionId },
    });
  }

  async createSectionItem(data: CreateSectionItemDto) {
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

  async updateSectionItem(itemId: string, data: UpdateSectionItemDto) {
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

  async deleteSectionItem(itemId: string) {
    return this.prisma.courseSectionItem.delete({
      where: { id: itemId },
    });
  }

  async reorderSections(courseId: string, sectionIds: string[]) {
    const updates = sectionIds.map((id, i) =>
      this.prisma.courseSection.update({
        where: { id },
        data: { sortOrder: i },
      }),
    );
    return this.prisma.$transaction(updates);
  }

  async reorderSectionItems(sectionId: string, itemIds: string[]) {
    const updates = itemIds.map((id, i) =>
      this.prisma.courseSectionItem.update({
        where: { id },
        data: { sortOrder: i },
      }),
    );
    return this.prisma.$transaction(updates);
  }
}
