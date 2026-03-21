import { EmailCampaignService } from './email-campaign.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email.service';
import { TransactionalEmailService } from '../transactional-email.service';

describe('EmailCampaignService tenant isolation', () => {
  it('getOneForTenant scopes by tenantId', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = { emailCampaign: { findFirst } } as unknown as PrismaService;
    const emailService = { enqueue: jest.fn() } as unknown as EmailService;
    const transactionalEmail = {
      canSend: jest.fn().mockResolvedValue(true),
    } as unknown as TransactionalEmailService;
    const svc = new EmailCampaignService(prisma, emailService, transactionalEmail);

    await expect(svc.getOneForTenant('c1', 't1')).rejects.toThrow('not found');
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'c1', tenantId: 't1' } });
  });
});
