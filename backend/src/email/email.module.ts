import { Module, Global } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EmailService } from './email.service';
import { EmailProcessorService } from './email-processor.service';
import { EmailConfigService } from './email-config.service';
import { ResendClientService } from './resend-client.service';
import { RateLimiterService } from './rate-limiter.service';
import { EmailAdminController } from './email-admin.controller';

@Global()
@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [EmailAdminController],
  providers: [
    EmailService,
    EmailProcessorService,
    EmailConfigService,
    ResendClientService,
    RateLimiterService,
  ],
  exports: [EmailService, EmailConfigService],
})
export class EmailModule {}
