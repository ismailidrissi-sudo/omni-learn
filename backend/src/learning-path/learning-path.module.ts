import { Module } from '@nestjs/common';
import { LearningPathService } from './learning-path.service';
import { LearningPathController } from './learning-path.controller';
import { LearningPathCrudService } from './learning-path-crud.service';
import { AuthModule } from '../auth/auth.module';
import { CertificateModule } from '../certificate/certificate.module';
import { NotificationModule } from '../notification/notification.module';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [AuthModule, CertificateModule, NotificationModule, GamificationModule],
  controllers: [LearningPathController],
  providers: [LearningPathService, LearningPathCrudService],
  exports: [LearningPathService, LearningPathCrudService],
})
export class LearningPathModule {}
