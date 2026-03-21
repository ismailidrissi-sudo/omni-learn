import { Test, TestingModule } from '@nestjs/testing';
import { CertificateUrlService } from './certificate-url.service';

describe('CertificateUrlService', () => {
  let service: CertificateUrlService;
  const TEST_SECRET = 'test-signing-secret-for-certs';

  beforeEach(async () => {
    process.env.CERTIFICATE_SIGNING_SECRET = TEST_SECRET;
    process.env.FRONTEND_URL = 'https://learn.example.com';

    const module: TestingModule = await Test.createTestingModule({
      providers: [CertificateUrlService],
    }).compile();

    service = module.get<CertificateUrlService>(CertificateUrlService);
  });

  afterEach(() => {
    delete process.env.CERTIFICATE_SIGNING_SECRET;
    delete process.env.FRONTEND_URL;
  });

  describe('generateSignedUrl', () => {
    it('should produce a URL with signature and expiry params', () => {
      const { url, signature, expiresAt } = service.generateSignedUrl('cert-001');

      expect(url).toContain('https://learn.example.com/api/certificates/cert-001/download');
      expect(url).toContain(`sig=${signature}`);
      expect(url).toContain(`exp=${expiresAt}`);
    });

    it('should produce a valid hex signature', () => {
      const { signature } = service.generateSignedUrl('cert-002');

      expect(signature).toMatch(/^[0-9a-f]+$/);
      expect(signature).toHaveLength(64); // SHA-256 → 32 bytes → 64 hex chars
    });

    it('should set expiry ~30 days in the future by default', () => {
      const beforeSec = Math.floor(Date.now() / 1000);
      const { expiresAt } = service.generateSignedUrl('cert-003');
      const afterSec = Math.floor(Date.now() / 1000);

      const thirtyDaysSec = 30 * 86400;
      expect(expiresAt).toBeGreaterThanOrEqual(beforeSec + thirtyDaysSec - 1);
      expect(expiresAt).toBeLessThanOrEqual(afterSec + thirtyDaysSec + 1);
    });

    it('should respect custom expiresInDays', () => {
      const beforeSec = Math.floor(Date.now() / 1000);
      const { expiresAt } = service.generateSignedUrl('cert-004', 7);
      const afterSec = Math.floor(Date.now() / 1000);

      const sevenDaysSec = 7 * 86400;
      expect(expiresAt).toBeGreaterThanOrEqual(beforeSec + sevenDaysSec - 1);
      expect(expiresAt).toBeLessThanOrEqual(afterSec + sevenDaysSec + 1);
    });

    it('should produce different signatures for different certificate IDs', () => {
      const { signature: sig1 } = service.generateSignedUrl('cert-A');
      const { signature: sig2 } = service.generateSignedUrl('cert-B');

      expect(sig1).not.toBe(sig2);
    });
  });

  describe('validateSignature', () => {
    it('should return true for a valid, non-expired signature', () => {
      const { signature, expiresAt } = service.generateSignedUrl('cert-valid');

      const result = service.validateSignature('cert-valid', signature, expiresAt);

      expect(result).toBe(true);
    });

    it('should return false for a tampered certificate ID', () => {
      const { signature, expiresAt } = service.generateSignedUrl('cert-original');

      const result = service.validateSignature('cert-TAMPERED', signature, expiresAt);

      expect(result).toBe(false);
    });

    it('should return false for a tampered signature', () => {
      const { expiresAt } = service.generateSignedUrl('cert-tampered-sig');

      const result = service.validateSignature('cert-tampered-sig', 'ab'.repeat(32), expiresAt);

      expect(result).toBe(false);
    });

    it('should return false for a tampered expiry', () => {
      const { signature, expiresAt } = service.generateSignedUrl('cert-exp');

      const result = service.validateSignature('cert-exp', signature, expiresAt + 1);

      expect(result).toBe(false);
    });
  });

  describe('validateSignature — expired signatures', () => {
    it('should return false when the signature has expired', () => {
      const { signature } = service.generateSignedUrl('cert-expired');
      const pastExpiry = Math.floor(Date.now() / 1000) - 3600;

      const result = service.validateSignature('cert-expired', signature, pastExpiry);

      expect(result).toBe(false);
    });

    it('should return false for expiry of 0 (epoch)', () => {
      const { signature } = service.generateSignedUrl('cert-epoch');

      const result = service.validateSignature('cert-epoch', signature, 0);

      expect(result).toBe(false);
    });
  });

  describe('validateSignature — edge cases', () => {
    it('should return false for a non-hex signature string', () => {
      const expiresAt = Math.floor(Date.now() / 1000) + 86400;

      const result = service.validateSignature('cert-1', 'not-a-hex-string!', expiresAt);

      expect(result).toBe(false);
    });

    it('should return false for an empty signature', () => {
      const expiresAt = Math.floor(Date.now() / 1000) + 86400;

      const result = service.validateSignature('cert-1', '', expiresAt);

      expect(result).toBe(false);
    });
  });
});
