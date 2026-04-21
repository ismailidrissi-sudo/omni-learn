import { Module } from '@nestjs/common';
import { CourseEnrollmentController } from './course-enrollment.controller';
import { CourseEnrollmentService } from './course-enrollment.service';
import { AuthModule } from '../auth/auth.module';
import { CertificateModule } from '../certificate/certificate.module';
import { NotificationModule } from '../notification/notification.module';
import { ReferralModule } from '../referral/referral.module';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [
    AuthModule,
    CertificateModule,
    NotificationModule,
    ReferralModule,
    GamificationModule,
  ],
  controllers: [CourseEnrollmentController],
  providers: [CourseEnrollmentService],
  exports: [CourseEnrollmentService],
})
export class CourseEnrollmentModule {}
