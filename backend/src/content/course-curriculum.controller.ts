import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CourseCurriculumService } from './course-curriculum.service';
import { RbacGuard } from '../auth/guards/rbac.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RbacRole } from '../constants/rbac.constant';
import type {
  CreateSectionDto,
  UpdateSectionDto,
  CreateSectionItemDto,
  UpdateSectionItemDto,
} from './course-curriculum.service';

@Controller('curriculum')
@UseGuards(AuthGuard('jwt'), RbacGuard)
export class CourseCurriculumController {
  constructor(private readonly curriculum: CourseCurriculumService) {}

  @Get('courses/:courseId')
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.INSTRUCTOR, RbacRole.LEARNER_PRO, RbacRole.LEARNER_BASIC)
  async getCurriculum(@Param('courseId') courseId: string) {
    return this.curriculum.getCourseCurriculum(courseId);
  }

  @Post('courses/:courseId/sections')
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.INSTRUCTOR)
  async createSection(
    @Param('courseId') courseId: string,
    @Body() body: Omit<CreateSectionDto, 'courseId'>,
  ) {
    return this.curriculum.createSection({ ...body, courseId });
  }

  @Put('sections/:sectionId')
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.INSTRUCTOR)
  async updateSection(
    @Param('sectionId') sectionId: string,
    @Body() body: UpdateSectionDto,
  ) {
    return this.curriculum.updateSection(sectionId, body);
  }

  @Delete('sections/:sectionId')
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.INSTRUCTOR)
  async deleteSection(@Param('sectionId') sectionId: string) {
    return this.curriculum.deleteSection(sectionId);
  }

  @Post('sections/:sectionId/items')
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.INSTRUCTOR)
  async createSectionItem(
    @Param('sectionId') sectionId: string,
    @Body() body: Omit<CreateSectionItemDto, 'sectionId'>,
  ) {
    return this.curriculum.createSectionItem({ ...body, sectionId });
  }

  @Put('sections/items/:itemId')
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.INSTRUCTOR)
  async updateSectionItem(
    @Param('itemId') itemId: string,
    @Body() body: UpdateSectionItemDto,
  ) {
    return this.curriculum.updateSectionItem(itemId, body);
  }

  @Delete('sections/items/:itemId')
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.INSTRUCTOR)
  async deleteSectionItem(@Param('itemId') itemId: string) {
    return this.curriculum.deleteSectionItem(itemId);
  }

  @Put('courses/:courseId/sections/reorder')
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.INSTRUCTOR)
  async reorderSections(
    @Param('courseId') courseId: string,
    @Body() body: { sectionIds: string[] },
  ) {
    return this.curriculum.reorderSections(courseId, body.sectionIds);
  }

  @Put('sections/:sectionId/items/reorder')
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.INSTRUCTOR)
  async reorderSectionItems(
    @Param('sectionId') sectionId: string,
    @Body() body: { itemIds: string[] },
  ) {
    return this.curriculum.reorderSectionItems(sectionId, body.itemIds);
  }
}
