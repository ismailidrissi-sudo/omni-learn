import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { EmailProvider, SendEmailParams } from './email-provider.interface';

/**
 * Self-hosted SMTP (e.g. Hostinger). Configure via env:
 * SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASS, SMTP_SECURE (optional),
 * SMTP_FROM_EMAIL, SMTP_FROM_NAME
 */
@Injectable()
export class SmtpEmailProvider implements EmailProvider {
  readonly name = 'smtp';
  private readonly logger = new Logger(SmtpEmailProvider.name);

  async send(params: SendEmailParams): Promise<{ id: string }> {
    const host = process.env.SMTP_HOST;
    if (!host) {
      throw new Error('SMTP not configured: set SMTP_HOST (and SMTP_USER/SMTP_PASS if required)');
    }

    const port = Number(process.env.SMTP_PORT || 587);
    const secure = process.env.SMTP_SECURE === 'true';
    const user = process.env.SMTP_USER || '';
    const pass = process.env.SMTP_PASS || '';

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass } : undefined,
    });

    const fromEmail = params.fromEmail || process.env.SMTP_FROM_EMAIL || 'noreply@localhost';
    const fromName = params.fromName || process.env.SMTP_FROM_NAME || 'OmniLearn';
    const from = `${fromName} <${fromEmail}>`;

    const info = await transporter.sendMail({
      from,
      to: params.toName ? `${params.toName} <${params.toEmail}>` : params.toEmail,
      subject: params.subject,
      html: params.htmlBody,
      text: params.textBody,
      replyTo: params.replyTo,
    });

    const id = info.messageId || `smtp-${Date.now()}`;
    this.logger.log(`SMTP sent messageId=${id} to=${params.toEmail}`);
    return { id };
  }
}
