import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { CourseCurriculumService } from './course-curriculum.service';
import type {
  CreateSectionDto,
  UpdateSectionDto,
  CreateSectionItemDto,
  UpdateSectionItemDto,
} from './course-curriculum.service';

@Controller('curriculum')
export class CourseCurriculumController {
  constructor(private readonly curriculum: CourseCurriculumService) {}

  @Get('courses/:courseId')
  async getCurriculum(@Param('courseId') courseId: string) {
    return this.curriculum.getCourseCurriculum(courseId);
  }

  @Post('courses/:courseId/sections')
  async createSection(
    @Param('courseId') courseId: string,
    @Body() body: Omit<CreateSectionDto, 'courseId'>,
  ) {
    return this.curriculum.createSection({ ...body, courseId });
  }

  @Put('sections/:sectionId')
  async updateSection(
    @Param('sectionId') sectionId: string,
    @Body() body: UpdateSectionDto,
  ) {
    return this.curriculum.updateSection(sectionId, body);
  }

  @Delete('sections/:sectionId')
  async deleteSection(@Param('sectionId') sectionId: string) {
    return this.curriculum.deleteSection(sectionId);
  }

  @Post('sections/:sectionId/items')
  async createSectionItem(
    @Param('sectionId') sectionId: string,
    @Body() body: Omit<CreateSectionItemDto, 'sectionId'>,
  ) {
    return this.curriculum.createSectionItem({ ...body, sectionId });
  }

  @Put('sections/items/:itemId')
  async updateSectionItem(
    @Param('itemId') itemId: string,
    @Body() body: UpdateSectionItemDto,
  ) {
    return this.curriculum.updateSectionItem(itemId, body);
  }

  @Delete('sections/items/:itemId')
  async deleteSectionItem(@Param('itemId') itemId: string) {
    return this.curriculum.deleteSectionItem(itemId);
  }

  @Put('courses/:courseId/sections/reorder')
  async reorderSections(
    @Param('courseId') courseId: string,
    @Body() body: { sectionIds: string[] },
  ) {
    return this.curriculum.reorderSections(courseId, body.sectionIds);
  }

  @Put('sections/:sectionId/items/reorder')
  async reorderSectionItems(
    @Param('sectionId') sectionId: string,
    @Body() body: { itemIds: string[] },
  ) {
    return this.curriculum.reorderSectionItems(sectionId, body.itemIds);
  }
}
