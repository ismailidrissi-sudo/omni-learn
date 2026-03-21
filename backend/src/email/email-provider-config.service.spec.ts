import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EmailProviderConfigService, ProviderUsage } from './email-provider-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { ResendEmailProvider } from './providers/resend-email.provider';
import { SmtpEmailProvider } from './providers/smtp-email.provider';
import * as encryption from './encryption.util';

jest.mock('./encryption.util', () => ({
  encryptApiKey: jest.fn((v: string) => `encrypted:${v}`),
  decryptApiKey: jest.fn((v: string) => v.replace('encrypted:', '')),
  maskApiKey: jest.fn((v: string) => `••••${v.slice(-4)}`),
}));

describe('EmailProviderConfigService', () => {
  let service: EmailProviderConfigService;

  const mockPrisma = {
    emailProviderConfig: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $executeRaw: jest.fn(),
  } as unknown as PrismaService;

  const mockResendProvider = {
    name: 'resend',
    send: jest.fn(),
  } as unknown as ResendEmailProvider;

  const mockSmtpProvider = {
    name: 'smtp',
    send: jest.fn(),
  } as unknown as SmtpEmailProvider;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailProviderConfigService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ResendEmailProvider, useValue: mockResendProvider },
        { provide: SmtpEmailProvider, useValue: mockSmtpProvider },
      ],
    }).compile();

    service = module.get<EmailProviderConfigService>(EmailProviderConfigService);
    service.invalidateCache();
  });

  describe('getActiveConfig', () => {
    it('should return null when no active config exists', async () => {
      (mockPrisma as any).emailProviderConfig.findFirst.mockResolvedValue(null);

      const result = await service.getActiveConfig();

      expect(result).toBeNull();
      expect((mockPrisma as any).emailProviderConfig.findFirst).toHaveBeenCalledWith({
        where: { isActive: true },
      });
    });

    it('should return the active config when one exists', async () => {
      const config = { id: 'cfg-1', providerType: 'resend', isActive: true };
      (mockPrisma as any).emailProviderConfig.findFirst.mockResolvedValue(config);

      const result = await service.getActiveConfig();

      expect(result).toEqual(config);
    });

    it('should return cached config on subsequent calls within TTL', async () => {
      const config = { id: 'cfg-1', providerType: 'resend', isActive: true };
      (mockPrisma as any).emailProviderConfig.findFirst.mockResolvedValue(config);

      await service.getActiveConfig();
      await service.getActiveConfig();

      expect((mockPrisma as any).emailProviderConfig.findFirst).toHaveBeenCalledTimes(1);
    });

    it('should refetch after cache is invalidated', async () => {
      const config = { id: 'cfg-1', providerType: 'resend', isActive: true };
      (mockPrisma as any).emailProviderConfig.findFirst.mockResolvedValue(config);

      await service.getActiveConfig();
      service.invalidateCache();
      await service.getActiveConfig();

      expect((mockPrisma as any).emailProviderConfig.findFirst).toHaveBeenCalledTimes(2);
    });
  });

  describe('createConfig', () => {
    it('should create a config with default rate limits', async () => {
      const created = { id: 'cfg-new', providerType: 'resend', displayName: 'Test' };
      (mockPrisma as any).emailProviderConfig.create.mockResolvedValue(created);

      const result = await service.createConfig({
        providerType: 'resend',
        displayName: 'Test',
      });

      expect(result).toEqual(created);
      const createCall = (mockPrisma as any).emailProviderConfig.create.mock.calls[0][0];
      expect(createCall.data.sendLimitPerMinute).toBe(10);
      expect(createCall.data.sendLimitPerHour).toBe(100);
      expect(createCall.data.sendLimitPerDay).toBe(500);
    });

    it('should encrypt SMTP password when provided', async () => {
      (mockPrisma as any).emailProviderConfig.create.mockResolvedValue({ id: 'cfg-1' });

      await service.createConfig({
        providerType: 'smtp',
        displayName: 'SMTP Config',
        smtpPassword: 'my-secret-password',
      });

      expect(encryption.encryptApiKey).toHaveBeenCalledWith('my-secret-password');
      const createCall = (mockPrisma as any).emailProviderConfig.create.mock.calls[0][0];
      expect(createCall.data.smtpPasswordEncrypted).toBe('encrypted:my-secret-password');
    });

    it('should encrypt Resend API key when provided', async () => {
      (mockPrisma as any).emailProviderConfig.create.mockResolvedValue({ id: 'cfg-1' });

      await service.createConfig({
        providerType: 'resend',
        displayName: 'Resend Config',
        resendApiKey: 're_test_123456',
      });

      expect(encryption.encryptApiKey).toHaveBeenCalledWith('re_test_123456');
      const createCall = (mockPrisma as any).emailProviderConfig.create.mock.calls[0][0];
      expect(createCall.data.resendApiKeyEncrypted).toBe('encrypted:re_test_123456');
    });

    it('should deactivate other configs when isActive is true', async () => {
      (mockPrisma as any).emailProviderConfig.create.mockResolvedValue({ id: 'cfg-1' });

      await service.createConfig({
        providerType: 'resend',
        displayName: 'Active',
        isActive: true,
      });

      expect((mockPrisma as any).emailProviderConfig.updateMany).toHaveBeenCalledWith({
        where: { isActive: true },
        data: { isActive: false },
      });
    });

    it('should NOT deactivate other configs when isActive is false', async () => {
      (mockPrisma as any).emailProviderConfig.create.mockResolvedValue({ id: 'cfg-1' });

      await service.createConfig({
        providerType: 'resend',
        displayName: 'Inactive',
        isActive: false,
      });

      expect((mockPrisma as any).emailProviderConfig.updateMany).not.toHaveBeenCalled();
    });

    it('should invalidate cache after creation', async () => {
      const config = { id: 'cfg-old', providerType: 'resend', isActive: true };
      (mockPrisma as any).emailProviderConfig.findFirst.mockResolvedValue(config);
      await service.getActiveConfig();

      (mockPrisma as any).emailProviderConfig.create.mockResolvedValue({ id: 'cfg-new' });
      await service.createConfig({ providerType: 'resend', displayName: 'New' });

      const newConfig = { id: 'cfg-new', providerType: 'resend', isActive: true };
      (mockPrisma as any).emailProviderConfig.findFirst.mockResolvedValue(newConfig);
      const result = await service.getActiveConfig();

      expect((mockPrisma as any).emailProviderConfig.findFirst).toHaveBeenCalledTimes(2);
    });
  });

  describe('canSend', () => {
    it('should return true when all counters are under limits', () => {
      const usage: ProviderUsage = {
        thisMinute: 5,
        thisHour: 50,
        today: 200,
        limitPerMinute: 10,
        limitPerHour: 100,
        limitPerDay: 500,
        minuteResetAt: null,
        hourResetAt: null,
        dayResetAt: null,
      };

      expect(service.canSend(usage)).toBe(true);
    });

    it('should return false when minute limit is reached', () => {
      const usage: ProviderUsage = {
        thisMinute: 10,
        thisHour: 50,
        today: 200,
        limitPerMinute: 10,
        limitPerHour: 100,
        limitPerDay: 500,
        minuteResetAt: null,
        hourResetAt: null,
        dayResetAt: null,
      };

      expect(service.canSend(usage)).toBe(false);
    });

    it('should return false when hour limit is reached', () => {
      const usage: ProviderUsage = {
        thisMinute: 5,
        thisHour: 100,
        today: 200,
        limitPerMinute: 10,
        limitPerHour: 100,
        limitPerDay: 500,
        minuteResetAt: null,
        hourResetAt: null,
        dayResetAt: null,
      };

      expect(service.canSend(usage)).toBe(false);
    });

    it('should return false when day limit is reached', () => {
      const usage: ProviderUsage = {
        thisMinute: 5,
        thisHour: 50,
        today: 500,
        limitPerMinute: 10,
        limitPerHour: 100,
        limitPerDay: 500,
        minuteResetAt: null,
        hourResetAt: null,
        dayResetAt: null,
      };

      expect(service.canSend(usage)).toBe(false);
    });

    it('should return false when counters exceed limits', () => {
      const usage: ProviderUsage = {
        thisMinute: 15,
        thisHour: 150,
        today: 600,
        limitPerMinute: 10,
        limitPerHour: 100,
        limitPerDay: 500,
        minuteResetAt: null,
        hourResetAt: null,
        dayResetAt: null,
      };

      expect(service.canSend(usage)).toBe(false);
    });
  });

  describe('availableThisTick', () => {
    it('should return the minimum remaining across all tiers', () => {
      const usage: ProviderUsage = {
        thisMinute: 7,
        thisHour: 90,
        today: 480,
        limitPerMinute: 10,
        limitPerHour: 100,
        limitPerDay: 500,
        minuteResetAt: null,
        hourResetAt: null,
        dayResetAt: null,
      };

      // remaining: minute=3, hour=10, day=20, maxBatch=50
      expect(service.availableThisTick(usage, 50)).toBe(3);
    });

    it('should respect the maxBatch cap', () => {
      const usage: ProviderUsage = {
        thisMinute: 0,
        thisHour: 0,
        today: 0,
        limitPerMinute: 10,
        limitPerHour: 100,
        limitPerDay: 500,
        minuteResetAt: null,
        hourResetAt: null,
        dayResetAt: null,
      };

      expect(service.availableThisTick(usage, 5)).toBe(5);
    });

    it('should return 0 when any tier is exhausted', () => {
      const usage: ProviderUsage = {
        thisMinute: 10,
        thisHour: 50,
        today: 200,
        limitPerMinute: 10,
        limitPerHour: 100,
        limitPerDay: 500,
        minuteResetAt: null,
        hourResetAt: null,
        dayResetAt: null,
      };

      expect(service.availableThisTick(usage, 50)).toBe(0);
    });

    it('should return negative when over limit (caller should clamp)', () => {
      const usage: ProviderUsage = {
        thisMinute: 12,
        thisHour: 50,
        today: 200,
        limitPerMinute: 10,
        limitPerHour: 100,
        limitPerDay: 500,
        minuteResetAt: null,
        hourResetAt: null,
        dayResetAt: null,
      };

      expect(service.availableThisTick(usage, 50)).toBeLessThan(0);
    });
  });

  describe('resolveProvider', () => {
    it('should return SMTP provider for smtp type', () => {
      const provider = service.resolveProvider({ providerType: 'smtp' });
      expect(provider).toBe(mockSmtpProvider);
    });

    it('should return Resend provider for resend type', () => {
      const provider = service.resolveProvider({ providerType: 'resend' });
      expect(provider).toBe(mockResendProvider);
    });

    it('should default to Resend for unknown type', () => {
      const provider = service.resolveProvider({ providerType: 'unknown' });
      expect(provider).toBe(mockResendProvider);
    });
  });

  describe('maskedView', () => {
    it('should mask SMTP password', () => {
      const config = { id: 'cfg-1', smtpPasswordEncrypted: 'encrypted:secret' };
      const view = service.maskedView(config);

      expect(view.smtpPasswordMasked).toBe('••••••••');
      expect(view.smtpPasswordEncrypted).toBeUndefined();
    });

    it('should mask Resend API key using decrypted value', () => {
      const config = { id: 'cfg-1', resendApiKeyEncrypted: 'encrypted:re_live_abcdef12345' };
      const view = service.maskedView(config);

      expect(view.resendApiKeyMasked).toBeDefined();
      expect(view.resendApiKeyEncrypted).toBeUndefined();
    });
  });

  describe('getById', () => {
    it('should throw NotFoundException when config is not found', async () => {
      (mockPrisma as any).emailProviderConfig.findUnique.mockResolvedValue(null);

      await expect(service.getById('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should return config when found', async () => {
      const config = { id: 'cfg-1', providerType: 'resend' };
      (mockPrisma as any).emailProviderConfig.findUnique.mockResolvedValue(config);

      const result = await service.getById('cfg-1');
      expect(result).toEqual(config);
    });
  });
});
