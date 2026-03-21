import { Test, TestingModule } from '@nestjs/testing';
import { EmailProcessorService } from './email-processor.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailConfigService } from './email-config.service';
import { EmailProviderConfigService } from './email-provider-config.service';
import { ResendEmailProvider } from './providers/resend-email.provider';
import { SmtpEmailProvider } from './providers/smtp-email.provider';
import { RateLimiterService } from './rate-limiter.service';

function makeQueueRow(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: overrides.id ?? 'email-1',
    toEmail: overrides.toEmail ?? 'user@example.com',
    toName: overrides.toName ?? null,
    fromEmail: overrides.fromEmail ?? null,
    fromName: overrides.fromName ?? null,
    replyTo: overrides.replyTo ?? null,
    subject: overrides.subject ?? 'Test Subject',
    htmlBody: overrides.htmlBody ?? '<p>Hello</p>',
    textBody: overrides.textBody ?? null,
    priority: overrides.priority ?? 'NORMAL',
    attempts: overrides.attempts ?? 0,
    maxAttempts: overrides.maxAttempts ?? 3,
  };
}

describe('EmailProcessorService', () => {
  let service: EmailProcessorService;

  const mockProvider = {
    name: 'resend',
    send: jest.fn().mockResolvedValue({ id: 'msg-001' }),
  };

  const mockPrisma = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    $executeRaw: jest.fn(),
    emailQueue: {
      update: jest.fn().mockResolvedValue({}),
    },
    emailLog: {
      updateMany: jest.fn().mockResolvedValue({}),
    },
    emailBounceSuppression: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  } as unknown as PrismaService;

  const mockConfigService = {
    getConfig: jest.fn().mockResolvedValue({
      isActive: true,
      dailySendLimit: 500,
      overflowSendHour: 6,
    }),
  } as unknown as EmailConfigService;

  const mockProviderConfigService = {
    getActiveConfig: jest.fn().mockResolvedValue(null),
    resolveProvider: jest.fn().mockReturnValue(mockProvider),
    getCurrentUsage: jest.fn(),
    canSend: jest.fn().mockReturnValue(true),
    incrementUsage: jest.fn(),
  } as unknown as EmailProviderConfigService;

  const mockResendProvider = {
    name: 'resend',
    send: jest.fn().mockResolvedValue({ id: 'msg-001' }),
  } as unknown as ResendEmailProvider;

  const mockSmtpProvider = {
    name: 'smtp',
    send: jest.fn(),
  } as unknown as SmtpEmailProvider;

  const mockRateLimiter = {
    getRemainingToday: jest.fn().mockResolvedValue(100),
    incrementDailyCount: jest.fn(),
    incrementFailedCount: jest.fn(),
    incrementOverflowCount: jest.fn(),
  } as unknown as RateLimiterService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailProcessorService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EmailConfigService, useValue: mockConfigService },
        { provide: EmailProviderConfigService, useValue: mockProviderConfigService },
        { provide: ResendEmailProvider, useValue: mockResendProvider },
        { provide: SmtpEmailProvider, useValue: mockSmtpProvider },
        { provide: RateLimiterService, useValue: mockRateLimiter },
      ],
    }).compile();

    service = module.get<EmailProcessorService>(EmailProcessorService);
  });

  describe('processQueue — priority ordering', () => {
    it('should process emails in priority order (CRITICAL first)', async () => {
      const criticalEmail = makeQueueRow({ id: 'e-crit', priority: 'CRITICAL' });
      const normalEmail = makeQueueRow({ id: 'e-norm', priority: 'NORMAL' });
      const lowEmail = makeQueueRow({ id: 'e-low', priority: 'LOW' });

      (mockPrisma as any).$queryRaw.mockResolvedValue([criticalEmail, normalEmail, lowEmail]);
      mockResendProvider.send = jest.fn().mockResolvedValue({ id: 'msg-001' });

      await service.processQueue();

      const sendCalls = (mockResendProvider.send as jest.Mock).mock.calls;
      expect(sendCalls).toHaveLength(3);
      expect(sendCalls[0][0].toEmail).toBe(criticalEmail.toEmail);
    });

    it('should do nothing when the queue is empty', async () => {
      (mockPrisma as any).$queryRaw.mockResolvedValue([]);

      await service.processQueue();

      expect(mockResendProvider.send).not.toHaveBeenCalled();
    });
  });

  describe('processQueue — bounce suppression', () => {
    it('should skip emails to suppressed addresses', async () => {
      const email = makeQueueRow({ id: 'e-bounced', toEmail: 'bounced@example.com' });
      (mockPrisma as any).$queryRaw.mockResolvedValue([email]);
      (mockPrisma as any).emailBounceSuppression.findUnique.mockResolvedValue({
        email: 'bounced@example.com',
        reason: 'hard_bounce',
      });

      await service.processQueue();

      expect(mockResendProvider.send).not.toHaveBeenCalled();
      expect((mockPrisma as any).emailQueue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'e-bounced' },
          data: expect.objectContaining({
            status: 'CANCELLED',
            lastError: 'suppressed:bounce',
          }),
        }),
      );
    });

    it('should send emails to non-suppressed addresses', async () => {
      const email = makeQueueRow({ id: 'e-ok', toEmail: 'valid@example.com' });
      (mockPrisma as any).$queryRaw.mockResolvedValue([email]);
      (mockPrisma as any).emailBounceSuppression.findUnique.mockResolvedValue(null);
      mockResendProvider.send = jest.fn().mockResolvedValue({ id: 'msg-ok' });

      await service.processQueue();

      expect(mockResendProvider.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('processQueue — rate limiting (legacy config path)', () => {
    it('should defer non-critical emails when at daily limit', async () => {
      const normalEmail = makeQueueRow({ id: 'e-norm', priority: 'NORMAL' });
      (mockPrisma as any).$queryRaw.mockResolvedValue([normalEmail]);
      (mockRateLimiter.getRemainingToday as jest.Mock).mockResolvedValue(0);

      await service.processQueue();

      expect(mockResendProvider.send).not.toHaveBeenCalled();
      expect((mockPrisma as any).emailQueue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'e-norm' },
          data: expect.objectContaining({ status: 'SCHEDULED' }),
        }),
      );
    });

    it('should send non-critical emails when under daily limit', async () => {
      const normalEmail = makeQueueRow({ id: 'e-norm', priority: 'NORMAL' });
      (mockPrisma as any).$queryRaw.mockResolvedValue([normalEmail]);
      (mockRateLimiter.getRemainingToday as jest.Mock).mockResolvedValue(50);
      mockResendProvider.send = jest.fn().mockResolvedValue({ id: 'msg-ok' });

      await service.processQueue();

      expect(mockResendProvider.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('processQueue — critical emails bypass rate limits', () => {
    it('should send critical emails even when at daily limit (legacy)', async () => {
      const criticalEmail = makeQueueRow({ id: 'e-crit', priority: 'CRITICAL' });
      (mockPrisma as any).$queryRaw.mockResolvedValue([criticalEmail]);
      (mockRateLimiter.getRemainingToday as jest.Mock).mockResolvedValue(0);
      mockResendProvider.send = jest.fn().mockResolvedValue({ id: 'msg-crit' });

      await service.processQueue();

      expect(mockResendProvider.send).toHaveBeenCalledTimes(1);
      expect((mockPrisma as any).emailQueue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'SENT' }),
        }),
      );
    });

    it('should send critical emails even when provider config at limit', async () => {
      const providerConfig = { id: 'prov-1', providerType: 'resend' };
      (mockProviderConfigService.getActiveConfig as jest.Mock).mockResolvedValue(providerConfig);
      (mockProviderConfigService.canSend as jest.Mock).mockReturnValue(false);
      (mockProviderConfigService.getCurrentUsage as jest.Mock).mockResolvedValue({
        thisMinute: 10,
        thisHour: 100,
        today: 500,
        limitPerMinute: 10,
        limitPerHour: 100,
        limitPerDay: 500,
      });
      (mockProviderConfigService.resolveProvider as jest.Mock).mockReturnValue(mockResendProvider);

      const criticalEmail = makeQueueRow({ id: 'e-crit', priority: 'CRITICAL' });
      (mockPrisma as any).$queryRaw.mockResolvedValue([criticalEmail]);
      mockResendProvider.send = jest.fn().mockResolvedValue({ id: 'msg-bypass' });

      await service.processQueue();

      expect(mockResendProvider.send).toHaveBeenCalledTimes(1);
    });

    it('should NOT increment usage counters for critical emails', async () => {
      const criticalEmail = makeQueueRow({ id: 'e-crit', priority: 'CRITICAL' });
      (mockPrisma as any).$queryRaw.mockResolvedValue([criticalEmail]);
      (mockRateLimiter.getRemainingToday as jest.Mock).mockResolvedValue(100);
      mockResendProvider.send = jest.fn().mockResolvedValue({ id: 'msg-crit' });

      await service.processQueue();

      expect(mockRateLimiter.incrementDailyCount).not.toHaveBeenCalled();
    });
  });

  describe('processQueue — provider config path rate limiting', () => {
    it('should defer non-critical emails when provider config says at limit', async () => {
      const providerConfig = { id: 'prov-1', providerType: 'resend' };
      (mockProviderConfigService.getActiveConfig as jest.Mock).mockResolvedValue(providerConfig);
      (mockProviderConfigService.getCurrentUsage as jest.Mock).mockResolvedValue({
        thisMinute: 10,
        thisHour: 100,
        today: 500,
        limitPerMinute: 10,
        limitPerHour: 100,
        limitPerDay: 500,
      });
      (mockProviderConfigService.canSend as jest.Mock).mockReturnValue(false);

      const normalEmail = makeQueueRow({ id: 'e-norm', priority: 'NORMAL' });
      (mockPrisma as any).$queryRaw.mockResolvedValue([normalEmail]);

      await service.processQueue();

      expect(mockResendProvider.send).not.toHaveBeenCalled();
    });
  });

  describe('processQueue — send failure handling', () => {
    it('should mark email as FAILED and schedule retry on error', async () => {
      (mockProviderConfigService.getActiveConfig as jest.Mock).mockResolvedValue(null);
      (mockRateLimiter.getRemainingToday as jest.Mock).mockResolvedValue(100);

      const email = makeQueueRow({ id: 'e-fail', attempts: 0, maxAttempts: 3 });
      (mockPrisma as any).$queryRaw.mockResolvedValue([email]);
      mockResendProvider.send = jest.fn().mockRejectedValue(new Error('SMTP timeout'));

      await service.processQueue();

      expect((mockPrisma as any).emailQueue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'e-fail' },
          data: expect.objectContaining({
            status: 'FAILED',
            attempts: 1,
            lastError: 'SMTP timeout',
          }),
        }),
      );
      expect(mockRateLimiter.incrementFailedCount).toHaveBeenCalled();
    });
  });
});
