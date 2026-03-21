import { ResendWebhookService } from './resend-webhook.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ResendWebhookService', () => {
  it('applyEmailEvent updates log for email.delivered', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = { emailLog: { updateMany } } as unknown as PrismaService;
    const svc = new ResendWebhookService(prisma);
    const r = await svc.applyEmailEvent({
      type: 'email.delivered',
      data: { email_id: 're_abc' },
    });
    expect(r.updated).toBe(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { providerMessageId: 're_abc' },
      data: { status: 'delivered' },
    });
  });

  it('applyEmailEvent skips unknown types', async () => {
    const updateMany = jest.fn();
    const prisma = { emailLog: { updateMany } } as unknown as PrismaService;
    const svc = new ResendWebhookService(prisma);
    const r = await svc.applyEmailEvent({ type: 'email.sent', data: { email_id: 'x' } });
    expect(r.updated).toBe(0);
    expect(updateMany).not.toHaveBeenCalled();
  });
});
