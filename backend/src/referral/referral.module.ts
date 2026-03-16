import { Module, forwardRef } from '@nestjs/common';
import { ReferralService } from './referral.service';
import { ReferralAnalyticsService } from './referral-analytics.service';
import { ReferralController } from './referral.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [ReferralController],
  providers: [ReferralService, ReferralAnalyticsService],
  exports: [ReferralService],
})
export class ReferralModule {}
