import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

/**
 * Mailer Service — Email sending for verification, notifications
 * omnilearn.space | Afflatus Consulting Group
 */

@Injectable()
export class MailerService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    const smtpUrl = process.env.SMTP_URL;
    const from = process.env.MAIL_FROM || 'noreply@omnilearn.space';
    if (smtpUrl) {
      this.transporter = nodemailer.createTransport(smtpUrl, { from });
    } else {
      // Dev: log to console instead of sending
      this.transporter = null;
    }
  }

  async sendVerificationEmail(email: string, name: string, verifyUrl: string): Promise<void> {
    const subject = 'Confirm your OmniLearn account';
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to OmniLearn, ${name}!</h2>
        <p>Please confirm your email address by clicking the link below:</p>
        <p><a href="${verifyUrl}" style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Confirm Email</a></p>
        <p>Or copy this link: ${verifyUrl}</p>
        <p>This link expires in 24 hours.</p>
        <p>If you didn't create an account, you can ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
        <p style="color: #666; font-size: 12px;">OmniLearn — Afflatus Consulting Group</p>
      </div>
    `;
    await this.send(email, subject, html);
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    const from = process.env.MAIL_FROM || 'noreply@omnilearn.space';
    if (this.transporter) {
      await this.transporter.sendMail({ from, to, subject, html });
    } else {
      // Dev fallback: log verification links to console
      const match = html.match(/href="([^"]+)"/);
      const link = match ? match[1] : '(no link)';
      console.log(`[Mailer] Would send to ${to}: ${subject}`);
      console.log(`[Mailer] Verification link: ${link}`);
    }
  }
}
