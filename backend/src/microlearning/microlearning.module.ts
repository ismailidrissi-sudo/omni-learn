import { Module } from '@nestjs/common';
import { MicrolearningService } from './microlearning.service';
import { MicrolearningController } from './microlearning.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [MicrolearningController],
  providers: [MicrolearningService],
})
export class MicrolearningModule {}
