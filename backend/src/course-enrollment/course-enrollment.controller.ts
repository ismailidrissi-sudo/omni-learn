import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { StepProgressStatus } from '../constants/db.constant';
import { CourseEnrollmentService } from './course-enrollment.service';
import { AccountStatusGuard } from '../auth/guards/account-status.guard';
import { PremiumAction } from '../auth/decorators/premium-action.decorator';

@Controller('course-enrollments')
export class CourseEnrollmentController {
  constructor(private readonly courseEnrollmentService: CourseEnrollmentService) {}

  @Post(':courseId/enroll')
  @UseGuards(AuthGuard('jwt'), AccountStatusGuard)
  @PremiumAction()
  async enroll(
    @Param('courseId') courseId: string,
    @Body() body: { userId: string; deadline?: string },
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.courseEnrollmentService.enrollUser(
      body.userId,
      courseId,
      body.deadline ? new Date(body.deadline) : undefined,
      { actorUserId: req.user?.sub },
    );
  }

  @Get(':courseId/enrollment/:userId')
  @UseGuards(AuthGuard('jwt'))
  async getEnrollment(
    @Param('courseId') courseId: string,
    @Param('userId') userId: string,
  ) {
    return this.courseEnrollmentService.getEnrollment(userId, courseId);
  }

  @Get('course/:courseId')
  @UseGuards(AuthGuard('jwt'))
  async getCourseEnrollments(@Param('courseId') courseId: string) {
    return this.courseEnrollmentService.getCourseEnrollments(courseId);
  }

  @Get('for-course')
  @UseGuards(AuthGuard('jwt'))
  async findEnrollmentForCourse(
    @Query('userId') userId: string,
    @Query('courseId') courseId: string,
  ) {
    return this.courseEnrollmentService.findEnrollmentForCourse(userId, courseId);
  }

  @Get('user/:userId')
  @UseGuards(AuthGuard('jwt'))
  async getUserEnrollments(@Param('userId') userId: string) {
    return this.courseEnrollmentService.getUserCourseEnrollments(userId);
  }

  @Post('enrollments/:enrollmentId/items/:sectionItemId/progress')
  @UseGuards(AuthGuard('jwt'))
  async updateItemProgress(
    @Param('enrollmentId') enrollmentId: string,
    @Param('sectionItemId') sectionItemId: string,
    @Body() body: { status?: string; timeSpent?: number; score?: number },
  ) {
    const validStatus = body.status && Object.values(StepProgressStatus).includes(body.status as (typeof StepProgressStatus)[keyof typeof StepProgressStatus])
      ? (body.status as (typeof StepProgressStatus)[keyof typeof StepProgressStatus])
      : undefined;

    return this.courseEnrollmentService.updateItemProgress(enrollmentId, sectionItemId, {
      status: validStatus,
      timeSpent: body.timeSpent,
      score: body.score,
    });
  }
}
