import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

@Injectable()
export class CertificateUrlService {
  private get signingSecret(): string {
    return process.env.CERTIFICATE_SIGNING_SECRET || 'change-me-in-production';
  }

  generateSignedUrl(
    certificateId: string,
    expiresInDays = 30,
  ): { url: string; signature: string; expiresAt: number } {
    const expiresAt = Math.floor(Date.now() / 1000) + expiresInDays * 86400;
    const payload = `${certificateId}:${expiresAt}`;
    const signature = createHmac('sha256', this.signingSecret)
      .update(payload)
      .digest('hex');

    const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:4000').replace(/\/$/, '');
    const url = `${baseUrl}/api/certificates/${certificateId}/download?sig=${signature}&exp=${expiresAt}`;

    return { url, signature, expiresAt };
  }

  validateSignature(
    certificateId: string,
    signature: string,
    expiresAt: number,
  ): boolean {
    if (Math.floor(Date.now() / 1000) > expiresAt) {
      return false;
    }

    const payload = `${certificateId}:${expiresAt}`;
    const expected = createHmac('sha256', this.signingSecret)
      .update(payload)
      .digest('hex');

    try {
      return timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expected, 'hex'),
      );
    } catch {
      return false;
    }
  }
}
