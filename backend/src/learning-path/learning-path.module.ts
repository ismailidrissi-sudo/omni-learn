import { Module } from '@nestjs/common';
import { LearningPathService } from './learning-path.service';
import { LearningPathController } from './learning-path.controller';
import { LearningPathCrudService } from './learning-path-crud.service';
import { AuthModule } from '../auth/auth.module';
import { CertificateModule } from '../certificate/certificate.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [AuthModule, CertificateModule, NotificationModule],
  controllers: [LearningPathController],
  providers: [LearningPathService, LearningPathCrudService],
  exports: [LearningPathService, LearningPathCrudService],
})
export class LearningPathModule {}
