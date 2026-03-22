import { Module } from '@nestjs/common';
import { MicrolearningService } from './microlearning.service';
import { MicrolearningController } from './microlearning.controller';
import { AuthModule } from '../auth/auth.module';
import { IntelligenceModule } from '../intelligence/intelligence.module';

@Module({
  imports: [AuthModule, IntelligenceModule],
  controllers: [MicrolearningController],
  providers: [MicrolearningService],
})
export class MicrolearningModule {}
