import {
  Controller,
  Post,
  Req,
  Headers,
  RawBodyRequest,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { StripeWebhookService } from './stripe.webhook.service';

/**
 * Stripe Webhook — Handles subscription lifecycle events
 * omnilearn.space | Updates plan_id on successful payment
 */
@Controller('subscription/webhook')
export class StripeWebhookController {
  constructor(private readonly stripeService: StripeWebhookService) {}

  @Post('stripe')
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException(
        'Raw body required for webhook verification. Configure Nest to use raw body for this route.',
      );
    }
    await this.stripeService.handleWebhook(rawBody, signature);
    return { received: true };
  }
}
