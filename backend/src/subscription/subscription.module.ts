import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AccessService } from './access.service';
import { StripeWebhookController } from './stripe.webhook.controller';
import { StripeWebhookService } from './stripe.webhook.service';
import { CompanyModule } from '../company/company.module';

@Module({
  imports: [PrismaModule, CompanyModule],
  controllers: [StripeWebhookController],
  providers: [AccessService, StripeWebhookService],
  exports: [AccessService],
})
export class SubscriptionModule {}
