import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

const SUPPORTED_LANGUAGES = ['en', 'fr', 'ar'] as const;
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

@Injectable()
export class EmailI18nService {
  private readonly logger = new Logger(EmailI18nService.name);
  private readonly cache = new Map<string, Record<string, string>>();
  private readonly localesDir = path.join(__dirname, 'locales');

  getTranslations(
    eventFile: string,
    language: string = 'en',
  ): Record<string, string> {
    const lang = this.normalizeLang(language);
    const cacheKey = `${lang}:${eventFile}`;

    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey)!;

    const translations = this.loadFile(lang, `events/${eventFile}`);
    const common = this.loadFile(lang, 'common');

    const merged = { ...common, ...translations };
    this.cache.set(cacheKey, merged);
    return merged;
  }

  getCommon(language: string = 'en'): Record<string, string> {
    const lang = this.normalizeLang(language);
    const cacheKey = `${lang}:__common`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey)!;

    const common = this.loadFile(lang, 'common');
    this.cache.set(cacheKey, common);
    return common;
  }

  private normalizeLang(language: string): SupportedLanguage {
    const lower = language.toLowerCase().split('-')[0] as SupportedLanguage;
    return SUPPORTED_LANGUAGES.includes(lower) ? lower : 'en';
  }

  private loadFile(lang: string, relativePath: string): Record<string, string> {
    const filePath = path.join(this.localesDir, lang, `${relativePath}.json`);
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      if (lang !== 'en') {
        return this.loadFile('en', relativePath);
      }
      this.logger.warn(`Locale file not found: ${filePath}`);
      return {};
    }
  }
}
