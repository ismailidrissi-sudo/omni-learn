import { Module } from '@nestjs/common';
import { LearningPathService } from './learning-path.service';
import { LearningPathController } from './learning-path.controller';
import { LearningPathCrudService } from './learning-path-crud.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [LearningPathController],
  providers: [LearningPathService, LearningPathCrudService],
  exports: [LearningPathService, LearningPathCrudService],
})
export class LearningPathModule {}
