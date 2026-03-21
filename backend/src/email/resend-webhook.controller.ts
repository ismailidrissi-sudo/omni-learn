import {
  BadRequestException,
  Controller,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ResendWebhookService } from './resend-webhook.service';

/**
 * Inbound Resend webhooks (Svix-signed). Configure URL in Resend dashboard: POST /webhooks/resend
 * Requires `RESEND_WEBHOOK_SECRET` and Nest `rawBody: true` (see main.ts).
 */
@Controller()
export class ResendWebhookController {
  constructor(private readonly webhook: ResendWebhookService) {}

  @Post('webhooks/resend')
  @HttpCode(200)
  async handle(@Req() req: Request & { rawBody?: Buffer }) {
    const rawBody = req.rawBody;
    if (!rawBody?.length) {
      throw new BadRequestException('Raw body required');
    }
    const svixId = req.headers['svix-id'],
      svixTimestamp = req.headers['svix-timestamp'],
      svixSignature = req.headers['svix-signature'];
    if (
      typeof svixId !== 'string' ||
      typeof svixTimestamp !== 'string' ||
      typeof svixSignature !== 'string'
    ) {
      throw new BadRequestException('Missing Svix webhook headers');
    }
    const payload = this.webhook.verifyAndParse(rawBody, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    });
    return this.webhook.applyEmailEvent(payload);
  }
}
