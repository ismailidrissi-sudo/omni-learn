import { Injectable } from '@nestjs/common';
import { ResendClientService } from '../resend-client.service';
import { EmailProvider, SendEmailParams } from './email-provider.interface';

@Injectable()
export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend';

  constructor(private readonly resend: ResendClientService) {}

  async send(params: SendEmailParams): Promise<{ id: string }> {
    return this.resend.send(params);
  }
}
