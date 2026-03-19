import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { EmailConfigService } from './email-config.service';
import { decryptApiKey } from './encryption.util';

export class ResendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResendError';
  }
}
export class ResendRateLimitError extends ResendError {
  constructor(message: string) {
    super(message);
    this.name = 'ResendRateLimitError';
  }
}
export class ResendValidationError extends ResendError {
  constructor(message: string) {
    super(message);
    this.name = 'ResendValidationError';
  }
}
export class ResendAuthError extends ResendError {
  constructor(message: string) {
    super(message);
    this.name = 'ResendAuthError';
  }
}

@Injectable()
export class ResendClientService {
  private readonly logger = new Logger(ResendClientService.name);
  private client: Resend | null = null;
  private currentKeyHash: string | null = null;

  constructor(private readonly configService: EmailConfigService) {}

  private async getClient(): Promise<Resend> {
    const config = await this.configService.getConfig();
    const apiKey = decryptApiKey(config.apiKey);
    const keyHash = apiKey.slice(-8);

    if (this.client && this.currentKeyHash === keyHash) {
      return this.client;
    }

    this.client = new Resend(apiKey);
    this.currentKeyHash = keyHash;
    return this.client;
  }

  async send(params: {
    toEmail: string;
    subject: string;
    htmlBody: string;
    toName?: string;
    fromEmail?: string;
    fromName?: string;
    replyTo?: string;
    textBody?: string;
  }): Promise<{ id: string }> {
    const config = await this.configService.getConfig();
    const client = await this.getClient();

    const senderEmail = params.fromEmail || config.defaultFromEmail;
    const senderName = params.fromName || config.defaultFromName;
    const fromAddress = `${senderName} <${senderEmail}>`;
    const toAddress = params.toName
      ? `${params.toName} <${params.toEmail}>`
      : params.toEmail;

    const payload: any = {
      from: fromAddress,
      to: [toAddress],
      subject: params.subject,
      html: params.htmlBody,
    };

    if (params.textBody) {
      payload.text = params.textBody;
    }

    const replyTo = params.replyTo || config.defaultReplyTo;
    if (replyTo) {
      payload.replyTo = replyTo;
    }

    const { data, error } = await client.emails.send(payload);

    if (error) {
      const message = error.message || 'Unknown Resend error';
      if (message.toLowerCase().includes('rate limit')) {
        throw new ResendRateLimitError(`Resend rate limit hit: ${message}`);
      }
      if (message.toLowerCase().includes('validation') || message.toLowerCase().includes('invalid')) {
        throw new ResendValidationError(`Invalid email data: ${message}`);
      }
      if (message.toLowerCase().includes('api key') || message.toLowerCase().includes('unauthorized')) {
        throw new ResendAuthError(`Invalid API key or unauthorized: ${message}`);
      }
      throw new ResendError(`Resend API error: ${message}`);
    }

    return { id: data?.id || '' };
  }

  async verifyKey(): Promise<{ valid: boolean; domains?: any[]; error?: string }> {
    try {
      const client = await this.getClient();
      const { data, error } = await client.domains.list();

      if (error) {
        return { valid: false, error: error.message };
      }

      return { valid: true, domains: data?.data || [] };
    } catch (e) {
      return { valid: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
}
