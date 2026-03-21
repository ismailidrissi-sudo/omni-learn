/**
 * Provider-agnostic outbound email contract. Resend and SMTP implementations
 * share this shape so the processor can swap transports without changing queue logic.
 */

export interface SendEmailParams {
  toEmail: string;
  subject: string;
  htmlBody: string;
  toName?: string;
  fromEmail?: string;
  fromName?: string;
  replyTo?: string;
  textBody?: string;
}

export interface EmailProvider {
  readonly name: string;
  send(params: SendEmailParams): Promise<{ id: string }>;
}
