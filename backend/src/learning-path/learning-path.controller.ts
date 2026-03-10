import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { StepProgressStatus } from '../constants/db.constant';
import { LearningPathService } from './learning-path.service';
import { LearningPathCrudService, CreatePathDto, CreateStepDto } from './learning-path-crud.service';

@Controller('learning-paths')
export class LearningPathController {
  constructor(
    private readonly learningPathService: LearningPathService,
    private readonly crudService: LearningPathCrudService,
  ) {}

  @Post(':pathId/enroll')
  async enroll(
    @Param('pathId') pathId: string,
    @Body() body: { userId: string; deadline?: string },
  ) {
    return this.learningPathService.enrollUser(
      body.userId,
      pathId,
      body.deadline ? new Date(body.deadline) : undefined,
    );
  }

  @Get(':pathId/enrollment/:userId')
  async getEnrollment(
    @Param('pathId') pathId: string,
    @Param('userId') userId: string,
  ) {
    return this.learningPathService.getEnrollment(userId, pathId);
  }

  @Get()
  async listPaths(@Query('tenantId') tenantId: string, @Query('domainId') domainId?: string) {
    return this.crudService.listPaths(tenantId, domainId);
  }

  @Get(':id')
  async getPath(@Param('id') id: string) {
    return this.crudService.getPath(id);
  }

  @Post()
  async createPath(@Body() body: CreatePathDto) {
    return this.crudService.createPath(body);
  }

  @Put(':id')
  async updatePath(@Param('id') id: string, @Body() body: Partial<CreatePathDto>) {
    return this.crudService.updatePath(id, body);
  }

  @Delete(':id')
  async deletePath(@Param('id') id: string) {
    return this.crudService.deletePath(id);
  }

  @Post(':pathId/steps')
  async addStep(@Param('pathId') pathId: string, @Body() body: Omit<CreateStepDto, 'pathId'>) {
    return this.crudService.addStep({ ...body, pathId });
  }

  @Put('steps/:stepId')
  async updateStep(@Param('stepId') stepId: string, @Body() body: Partial<CreateStepDto>) {
    return this.crudService.updateStep(stepId, body);
  }

  @Delete('steps/:stepId')
  async removeStep(@Param('stepId') stepId: string) {
    return this.crudService.removeStep(stepId);
  }

  @Post('enrollments/:enrollmentId/steps/:stepId/progress')
  async updateStepProgress(
    @Param('enrollmentId') enrollmentId: string,
    @Param('stepId') stepId: string,
    @Body() body: { status?: string; timeSpent?: number; score?: number },
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
