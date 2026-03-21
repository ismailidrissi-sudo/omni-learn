import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Webhook } from 'svix';
import { PrismaService } from '../prisma/prisma.service';

/** Maps Resend webhook `type` to `email_logs.status` (undefined = no DB update). */
const EVENT_TO_STATUS: Record<string, string | undefined> = {
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.failed': 'failed',
  'email.delivery_delayed': undefined,
  'email.sent': undefined,
};

interface ResendWebhookPayload {
  type?: string;
  data?: {
    email_id?: string;
    to?: string[];
  };
}

@Injectable()
export class ResendWebhookService {
  private readonly logger = new Logger(ResendWebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  verifyAndParse(
    rawBody: Buffer,
    headers: { 'svix-id': string; 'svix-timestamp': string; 'svix-signature': string },
  ): ResendWebhookPayload {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) {
      throw new UnauthorizedException('RESEND_WEBHOOK_SECRET is not configured');
    }
    const wh = new Webhook(secret);
    const parsed = wh.verify(rawBody.toString('utf8'), headers);
    if (typeof parsed === 'string') {
      return JSON.parse(parsed) as ResendWebhookPayload;
    }
    return parsed as ResendWebhookPayload;
  }

  async applyEmailEvent(payload: ResendWebhookPayload): Promise<{ updated: number }> {
    const type = payload.type || '';
    const nextStatus = EVENT_TO_STATUS[type];
    if (nextStatus === undefined) {
      return { updated: 0 };
    }

    const emailId = payload.data?.email_id;
    if (!emailId) {
      this.logger.warn(`Resend webhook ${type} missing data.email_id`);
      return { updated: 0 };
    }

    const result = await this.prisma.emailLog.updateMany({
      where: { providerMessageId: emailId },
      data: { status: nextStatus },
    });
    if (result.count === 0) {
      this.logger.debug(`No email_logs row for providerMessageId=${emailId} (type=${type})`);
    }

    if (nextStatus === 'bounced' || nextStatus === 'complained') {
      const reason = nextStatus === 'bounced' ? 'bounced' : 'complained';
      const logs = await this.prisma.emailLog.findMany({
        where: { providerMessageId: emailId },
        select: { id: true, recipientEmail: true },
      });
      const seen = new Set<string>();
      for (const log of logs) {
        const addr = log.recipientEmail.trim().toLowerCase();
        if (seen.has(addr)) continue;
        seen.add(addr);
        await this.prisma.emailBounceSuppression.upsert({
          where: { email: addr },
          create: {
            email: addr,
            reason,
            sourceEventId: log.id,
          },
          update: {
            reason,
            sourceEventId: log.id,
          },
        });
      }
      const fromPayload = payload.data?.to ?? [];
      for (const raw of fromPayload) {
        if (typeof raw !== 'string') continue;
        const addr = raw.trim().toLowerCase();
        if (!addr || seen.has(addr)) continue;
        seen.add(addr);
        await this.prisma.emailBounceSuppression.upsert({
          where: { email: addr },
          create: { email: addr, reason, sourceEventId: null },
          update: { reason, sourceEventId: null },
        });
      }
    }

    return { updated: result.count };
  }
}
