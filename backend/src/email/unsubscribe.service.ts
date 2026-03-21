import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

@Injectable()
export class UnsubscribeService {
  constructor(private readonly prisma: PrismaService) {}

  private getSecret(): string | undefined {
    return process.env.UNSUBSCRIBE_SECRET || process.env.EMAIL_ENCRYPTION_KEY || undefined;
  }

  private signPayload(userId: string, eventType: string, expiresAt: number): Buffer {
    const secret = this.getSecret();
    if (!secret) {
      throw new Error('UNSUBSCRIBE_SECRET or EMAIL_ENCRYPTION_KEY must be set to sign unsubscribe URLs');
    }
    return createHmac('sha256', secret)
      .update(`${userId}:${eventType}:${expiresAt}`)
      .digest();
  }

  generateUnsubscribeUrl(userId: string, eventType: string): string {
    const expiresAt = Date.now() + NINETY_DAYS_MS;
    const signature = this.signPayload(userId, eventType, expiresAt).toString('hex');
    const baseUrl = (process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/$/, '');
    return `${baseUrl}/unsubscribe?uid=${userId}&evt=${eventType}&sig=${signature}&exp=${expiresAt}`;
  }

  async validateAndApply(
    userId: string,
    eventType: string,
    signature: string,
    expiresAt: number,
  ): Promise<boolean> {
    const secret = this.getSecret();
    if (!secret) {
      return false;
    }
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
      return false;
    }
    if (!/^[0-9a-f]+$/i.test(signature) || signature.length % 2 !== 0) {
      return false;
    }
    let actual: Buffer;
    try {
      actual = Buffer.from(signature, 'hex');
    } catch {
      return false;
    }
    const expected = this.signPayload(userId, eventType, expiresAt);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      return false;
    }
    await this.prisma.userEmailPreference.upsert({
      where: { userId_eventType: { userId, eventType } },
      create: { userId, eventType, isEnabled: false },
      update: { isEnabled: false },
    });
    return true;
  }

  generateListUnsubscribeHeaders(
    userId: string,
    eventType: string,
  ): { 'List-Unsubscribe': string; 'List-Unsubscribe-Post': string } {
    const unsubscribeUrl = this.generateUnsubscribeUrl(userId, eventType);
    return {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    };
  }
}
