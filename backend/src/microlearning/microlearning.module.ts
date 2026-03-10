import { Module } from '@nestjs/common';
import { MicrolearningService } from './microlearning.service';
import { MicrolearningController } from './microlearning.controller';

@Module({
  controllers: [MicrolearningController],
  providers: [MicrolearningService],
})
export class MicrolearningModule {}
