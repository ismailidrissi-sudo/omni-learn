import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface LoadedEmailTemplate {
  id: string;
  slug: string;
  name: string;
  subjectTemplate: string;
  htmlTemplate: string;
  textTemplate: string | null;
  variables: unknown;
  language: string;
  eventType: string | null;
  version: number;
}

/**
 * Loads DB-backed templates by slug with language fallback (requested → en).
 */
@Injectable()
export class TemplateLoaderService {
  private readonly db: any;

  constructor(private readonly prisma: PrismaService) {
    this.db = prisma as any;
  }

  async loadActive(slug: string, language: string): Promise<LoadedEmailTemplate> {
    const preferred = await this.db.emailTemplate.findFirst({
      where: { slug, language, isActive: true },
      orderBy: { version: 'desc' },
    });
    if (preferred) {
      return preferred;
    }

    const fallback = await this.db.emailTemplate.findFirst({
      where: { slug, language: 'en', isActive: true },
      orderBy: { version: 'desc' },
    });
    if (fallback) {
      return fallback;
    }

    throw new NotFoundException(`Email template not found: ${slug} (${language})`);
  }
}
