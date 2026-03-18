import { Module } from '@nestjs/common';
import { TrainerProfileController } from './trainer-profile.controller';
import { TrainerProfileService } from './trainer-profile.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [TrainerProfileController],
  providers: [TrainerProfileService],
  exports: [TrainerProfileService],
})
export class TrainerProfileModule {}
