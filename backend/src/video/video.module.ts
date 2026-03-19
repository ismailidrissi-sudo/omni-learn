import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { VideoService } from './video.service';
import { VideoController } from './video.controller';
import { AuthModule } from '../auth/auth.module';
import { CourseEnrollmentModule } from '../course-enrollment/course-enrollment.module';

@Module({
  imports: [AuthModule, HttpModule, CourseEnrollmentModule],
  controllers: [VideoController],
  providers: [VideoService],
  exports: [VideoService],
})
export class VideoModule {}
