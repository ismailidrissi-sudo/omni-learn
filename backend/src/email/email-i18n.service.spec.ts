import { Test, TestingModule } from '@nestjs/testing';
import { EmailI18nService } from './email-i18n.service';
import * as fs from 'fs';

jest.mock('fs');

const ENGLISH_COMMON = {
  footer_text: '{{platform_name}} — Afflatus Consulting Group',
  footer_unsubscribe: 'Unsubscribe from these emails',
  greeting: 'Hi {{name}},',
};

const FRENCH_COMMON = {
  footer_text: '{{platform_name}} — Afflatus Consulting Group',
  footer_unsubscribe: 'Se désabonner de ces emails',
  greeting: 'Bonjour {{name}},',
};

const ENGLISH_VERIFICATION = {
  subject: 'Verify your email to get started on {{platform_name}}',
  heading: 'Welcome to {{platform_name}}!',
  cta: 'Confirm Email',
};

const FRENCH_VERIFICATION = {
  subject: 'Vérifiez votre email pour commencer sur {{platform_name}}',
  heading: 'Bienvenue sur {{platform_name}} !',
  cta: "Confirmer l'email",
};

function setupFsMock() {
  (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
    if (filePath.includes('/en/common.json') || filePath.includes('\\en\\common.json')) {
      return JSON.stringify(ENGLISH_COMMON);
    }
    if (filePath.includes('/fr/common.json') || filePath.includes('\\fr\\common.json')) {
      return JSON.stringify(FRENCH_COMMON);
    }
    if (
      filePath.includes('/en/events/email-verification.json') ||
      filePath.includes('\\en\\events\\email-verification.json')
    ) {
      return JSON.stringify(ENGLISH_VERIFICATION);
    }
    if (
      filePath.includes('/fr/events/email-verification.json') ||
      filePath.includes('\\fr\\events\\email-verification.json')
    ) {
      return JSON.stringify(FRENCH_VERIFICATION);
    }
    throw new Error(`ENOENT: no such file: ${filePath}`);
  });
}

describe('EmailI18nService', () => {
  let service: EmailI18nService;

  beforeEach(async () => {
    jest.clearAllMocks();
    setupFsMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailI18nService],
    }).compile();

    service = module.get<EmailI18nService>(EmailI18nService);
  });

  describe('getTranslations — defaults to English', () => {
    it('should return English translations when no language is specified', () => {
      const result = service.getTranslations('email-verification');

      expect(result.greeting).toBe('Hi {{name}},');
      expect(result.subject).toBe('Verify your email to get started on {{platform_name}}');
      expect(result.cta).toBe('Confirm Email');
    });

    it('should return English translations when "en" is explicitly passed', () => {
      const result = service.getTranslations('email-verification', 'en');

      expect(result.greeting).toBe('Hi {{name}},');
      expect(result.heading).toBe('Welcome to {{platform_name}}!');
    });
  });

  describe('getTranslations — falls back to English for unknown language', () => {
    it('should fall back to English for unsupported language code', () => {
      const result = service.getTranslations('email-verification', 'de');

      expect(result.greeting).toBe('Hi {{name}},');
      expect(result.subject).toBe('Verify your email to get started on {{platform_name}}');
    });

    it('should fall back to English for empty string', () => {
      const result = service.getTranslations('email-verification', '');

      expect(result.greeting).toBe('Hi {{name}},');
    });

    it('should fall back to English for nonsense language codes', () => {
      const result = service.getTranslations('email-verification', 'xyz-nonsense');

      expect(result.greeting).toBe('Hi {{name}},');
    });
  });

  describe('getTranslations — returns French when requested', () => {
    it('should return French translations for "fr"', () => {
      const result = service.getTranslations('email-verification', 'fr');

      expect(result.greeting).toBe('Bonjour {{name}},');
      expect(result.subject).toBe('Vérifiez votre email pour commencer sur {{platform_name}}');
      expect(result.cta).toBe("Confirmer l'email");
    });

    it('should handle language codes with region suffix (fr-FR)', () => {
      const result = service.getTranslations('email-verification', 'fr-FR');

      expect(result.greeting).toBe('Bonjour {{name}},');
    });

    it('should handle uppercase language codes', () => {
      const result = service.getTranslations('email-verification', 'FR');

      expect(result.greeting).toBe('Bonjour {{name}},');
    });
  });

  describe('getTranslations — merges common + event files', () => {
    it('should merge common keys with event-specific keys', () => {
      const result = service.getTranslations('email-verification', 'en');

      expect(result.footer_text).toBe('{{platform_name}} — Afflatus Consulting Group');
      expect(result.subject).toBe('Verify your email to get started on {{platform_name}}');
    });

    it('event-specific keys should override common keys with same name', () => {
      (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
        if (filePath.includes('/en/common.json') || filePath.includes('\\en\\common.json')) {
          return JSON.stringify({ shared_key: 'from_common' });
        }
        if (
          filePath.includes('/en/events/test-event.json') ||
          filePath.includes('\\en\\events\\test-event.json')
        ) {
          return JSON.stringify({ shared_key: 'from_event' });
        }
        throw new Error(`ENOENT: ${filePath}`);
      });

      const freshService = new EmailI18nService();
      const result = freshService.getTranslations('test-event', 'en');

      expect(result.shared_key).toBe('from_event');
    });
  });

  describe('getTranslations — caching', () => {
    it('should cache results and not re-read filesystem on second call', () => {
      service.getTranslations('email-verification', 'en');
      const callsAfterFirst = (fs.readFileSync as jest.Mock).mock.calls.length;

      service.getTranslations('email-verification', 'en');
      const callsAfterSecond = (fs.readFileSync as jest.Mock).mock.calls.length;

      expect(callsAfterSecond).toBe(callsAfterFirst);
    });
  });

  describe('getCommon', () => {
    it('should return only common translations', () => {
      const result = service.getCommon('en');

      expect(result.greeting).toBe('Hi {{name}},');
      expect(result.footer_unsubscribe).toBe('Unsubscribe from these emails');
      expect(result).not.toHaveProperty('subject');
    });

    it('should return French common translations', () => {
      const result = service.getCommon('fr');

      expect(result.greeting).toBe('Bonjour {{name}},');
    });
  });
});
