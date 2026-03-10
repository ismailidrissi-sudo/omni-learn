import { Module } from '@nestjs/common';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { XapiController } from './xapi.controller';
import { XapiService } from './xapi.service';
import { CourseCurriculumController } from './course-curriculum.controller';
import { CourseCurriculumService } from './course-curriculum.service';
import { SubscriptionModule } from '../subscription/subscription.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [SubscriptionModule, AuthModule],
  controllers: [CourseCurriculumController, ContentController, XapiController],
  providers: [ContentService, XapiService, CourseCurriculumService],
  exports: [ContentService, CourseCurriculumService],
})
export class ContentModule {}
