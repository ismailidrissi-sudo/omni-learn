import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { StepProgressStatus } from '../constants/db.constant';
import { LearningPathService } from './learning-path.service';
import { LearningPathCrudService, CreatePathDto, CreateStepDto } from './learning-path-crud.service';
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';
import { RbacGuard } from '../auth/guards/rbac.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RbacRole } from '../constants/rbac.constant';
import { EnrollDto, UpdateStepProgressDto } from '../dto/learning-path.dto';

@Controller('learning-paths')
export class LearningPathController {
  constructor(
    private readonly learningPathService: LearningPathService,
    private readonly crudService: LearningPathCrudService,
  ) {}

  @Post(':pathId/enroll')
  @UseGuards(AuthGuard('jwt'))
  async enroll(
    @Param('pathId') pathId: string,
    @Body() body: EnrollDto,
  ) {
    return this.learningPathService.enrollUser(
      body.userId,
      pathId,
      body.deadline ? new Date(body.deadline) : undefined,
    );
  }

  @Get(':pathId/enrollment/:userId')
  @UseGuards(AuthGuard('jwt'))
  async getEnrollment(
    @Param('pathId') pathId: string,
    @Param('userId') userId: string,
  ) {
    return this.learningPathService.getEnrollment(userId, pathId);
  }

  @Get('enrollment-for-content')
  @UseGuards(AuthGuard('jwt'))
  async findEnrollmentForContent(
    @Query('userId') userId: string,
    @Query('contentId') contentId: string,
  ) {
    return this.learningPathService.findEnrollmentForContent(userId, contentId);
  }

  @Post('auto-enroll-for-content')
  @UseGuards(AuthGuard('jwt'))
  async autoEnrollForContent(
    @Body() body: { userId: string; contentId: string },
  ) {
    return this.learningPathService.findOrAutoEnrollForContent(body.userId, body.contentId);
  }

  @Get()
  @UseGuards(OptionalJwtGuard)
  async listPaths(
    @Query('tenantId') tenantId: string,
    @Query('domainId') domainId?: string,
    @Query('includeDraft') includeDraft?: string,
  ) {
    return this.crudService.listPaths(tenantId, domainId, includeDraft === 'true');
  }

  @Get(':id')
  @UseGuards(OptionalJwtGuard)
  async getPath(@Param('id') id: string) {
    return this.crudService.getPath(id);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.INSTRUCTOR)
  async createPath(@Body() body: CreatePathDto) {
    return this.crudService.createPath(body);
  }

  @Put(':id')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.INSTRUCTOR)
  async updatePath(@Param('id') id: string, @Body() body: Partial<CreatePathDto>) {
    return this.crudService.updatePath(id, body);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  async deletePath(@Param('id') id: string) {
    return this.crudService.deletePath(id);
  }

  @Post(':pathId/steps')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.INSTRUCTOR)
  async addStep(@Param('pathId') pathId: string, @Body() body: Omit<CreateStepDto, 'pathId'>) {
    return this.crudService.addStep({ ...body, pathId });
  }

  @Put(':pathId/steps')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.INSTRUCTOR)
  async replaceSteps(
    @Param('pathId') pathId: string,
    @Body() body: { steps: Omit<CreateStepDto, 'pathId'>[] },
  ) {
    return this.crudService.replaceSteps(pathId, body.steps);
  }

  @Put('steps/:stepId')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.INSTRUCTOR)
  async updateStep(@Param('stepId') stepId: string, @Body() body: Partial<CreateStepDto>) {
    return this.crudService.updateStep(stepId, body);
  }

  @Delete('steps/:stepId')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  async removeStep(@Param('stepId') stepId: string) {
    return this.crudService.removeStep(stepId);
  }

  @Post('enrollments/:enrollmentId/steps/:stepId/progress')
  @UseGuards(AuthGuard('jwt'))
  async updateStepProgress(
    @Param('enrollmentId') enrollmentId: string,
    @Param('stepId') stepId: string,
    @Body() body: UpdateStepProgressDto,
  ) {
    const validStatus = body.status && Object.values(StepProgressStatus).includes(body.status as (typeof StepProgressStatus)[keyof typeof StepProgressStatus])
      ? (body.status as (typeof StepProgressStatus)[keyof typeof StepProgressStatus])
      : undefined;

    return this.learningPathService.updateStepProgress(enrollmentId, stepId, {
      status: validStatus,
      timeSpent: body.timeSpent,
      score: body.score,
    });
  }
}
