import { Test, TestingModule } from '@nestjs/testing';
import { UnsubscribeService } from './unsubscribe.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UnsubscribeService', () => {
  let service: UnsubscribeService;
  const MOCK_SECRET = 'a'.repeat(64);

  const mockPrisma = {
    userEmailPreference: {
      upsert: jest.fn().mockResolvedValue({}),
    },
  } as unknown as PrismaService;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.UNSUBSCRIBE_SECRET = MOCK_SECRET;
    process.env.FRONTEND_URL = 'https://app.example.com';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UnsubscribeService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UnsubscribeService>(UnsubscribeService);
  });

  afterEach(() => {
    delete process.env.UNSUBSCRIBE_SECRET;
    delete process.env.FRONTEND_URL;
  });

  describe('generateUnsubscribeUrl', () => {
    it('should produce a valid URL with uid, evt, sig, and exp params', () => {
      const url = service.generateUnsubscribeUrl('user-123', 'marketing');

      const parsed = new URL(url);
      expect(parsed.origin).toBe('https://app.example.com');
      expect(parsed.pathname).toBe('/unsubscribe');
      expect(parsed.searchParams.get('uid')).toBe('user-123');
      expect(parsed.searchParams.get('evt')).toBe('marketing');
      expect(parsed.searchParams.get('sig')).toBeTruthy();
      expect(parsed.searchParams.get('exp')).toBeTruthy();
    });

    it('should produce a signature that is a hex string', () => {
      const url = service.generateUnsubscribeUrl('user-456', 'notifications');
      const parsed = new URL(url);
      const sig = parsed.searchParams.get('sig')!;

      expect(sig).toMatch(/^[0-9a-f]+$/);
    });

    it('should set expiration ~90 days in the future', () => {
      const before = Date.now();
      const url = service.generateUnsubscribeUrl('user-789', 'digest');
      const after = Date.now();

      const parsed = new URL(url);
      const exp = Number(parsed.searchParams.get('exp'));
      const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;

      expect(exp).toBeGreaterThanOrEqual(before + ninetyDaysMs - 1000);
      expect(exp).toBeLessThanOrEqual(after + ninetyDaysMs + 1000);
    });

    it('should use FRONTEND_URL as base', () => {
      process.env.FRONTEND_URL = 'https://custom.domain.io';
      const url = service.generateUnsubscribeUrl('user-1', 'marketing');

      expect(url).toContain('https://custom.domain.io/unsubscribe');
    });

    it('should fallback to localhost when FRONTEND_URL is not set', () => {
      delete process.env.FRONTEND_URL;
      const url = service.generateUnsubscribeUrl('user-1', 'marketing');

      expect(url).toContain('http://localhost:3000/unsubscribe');
    });
  });

  describe('validateAndApply', () => {
    it('should succeed with a valid signature and update preferences', async () => {
      const url = service.generateUnsubscribeUrl('user-abc', 'weekly_digest');
      const parsed = new URL(url);

      const result = await service.validateAndApply(
        parsed.searchParams.get('uid')!,
        parsed.searchParams.get('evt')!,
        parsed.searchParams.get('sig')!,
        Number(parsed.searchParams.get('exp')),
      );

      expect(result).toBe(true);
      expect(mockPrisma.userEmailPreference.upsert).toHaveBeenCalledWith({
        where: { userId_eventType: { userId: 'user-abc', eventType: 'weekly_digest' } },
        create: { userId: 'user-abc', eventType: 'weekly_digest', isEnabled: false },
        update: { isEnabled: false },
      });
    });

    it('should reject an invalid signature', async () => {
      const url = service.generateUnsubscribeUrl('user-abc', 'marketing');
      const parsed = new URL(url);

      const result = await service.validateAndApply(
        parsed.searchParams.get('uid')!,
        parsed.searchParams.get('evt')!,
        'deadbeef'.repeat(8),
        Number(parsed.searchParams.get('exp')),
      );

      expect(result).toBe(false);
      expect(mockPrisma.userEmailPreference.upsert).not.toHaveBeenCalled();
    });

    it('should reject a tampered userId', async () => {
      const url = service.generateUnsubscribeUrl('user-abc', 'marketing');
      const parsed = new URL(url);

      const result = await service.validateAndApply(
        'user-TAMPERED',
        parsed.searchParams.get('evt')!,
        parsed.searchParams.get('sig')!,
        Number(parsed.searchParams.get('exp')),
      );

      expect(result).toBe(false);
    });

    it('should reject a tampered eventType', async () => {
      const url = service.generateUnsubscribeUrl('user-abc', 'marketing');
      const parsed = new URL(url);

      const result = await service.validateAndApply(
        parsed.searchParams.get('uid')!,
        'tampered_event',
        parsed.searchParams.get('sig')!,
        Number(parsed.searchParams.get('exp')),
      );

      expect(result).toBe(false);
    });
  });

  describe('validateAndApply — expired signatures', () => {
    it('should reject an expired signature', async () => {
      const url = service.generateUnsubscribeUrl('user-exp', 'marketing');
      const parsed = new URL(url);

      const pastExpiry = Date.now() - 1000;

      const result = await service.validateAndApply(
        parsed.searchParams.get('uid')!,
        parsed.searchParams.get('evt')!,
        parsed.searchParams.get('sig')!,
        pastExpiry,
      );

      expect(result).toBe(false);
      expect(mockPrisma.userEmailPreference.upsert).not.toHaveBeenCalled();
    });

    it('should reject non-finite expiresAt values', async () => {
      const result = await service.validateAndApply('user-1', 'marketing', 'aabbcc', NaN);
      expect(result).toBe(false);
    });

    it('should reject Infinity as expiresAt', async () => {
      const result = await service.validateAndApply('user-1', 'marketing', 'aabbcc', Infinity);
      expect(result).toBe(false);
    });
  });

  describe('validateAndApply — missing secret', () => {
    it('should return false when no secret is configured', async () => {
      delete process.env.UNSUBSCRIBE_SECRET;
      delete process.env.EMAIL_ENCRYPTION_KEY;

      const result = await service.validateAndApply(
        'user-1',
        'marketing',
        'aabbccdd',
        Date.now() + 100000,
      );

      expect(result).toBe(false);
    });
  });

  describe('generateListUnsubscribeHeaders', () => {
    it('should return RFC 8058 headers', () => {
      const headers = service.generateListUnsubscribeHeaders('user-1', 'marketing');

      expect(headers['List-Unsubscribe']).toMatch(/^<https:\/\/app\.example\.com\/unsubscribe\?/);
      expect(headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    });
  });
});
