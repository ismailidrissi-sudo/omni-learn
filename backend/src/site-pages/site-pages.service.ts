import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface SitePageSection {
  title: string;
  content: string;
}

export interface UpsertSitePageDto {
  title: string;
  sections: SitePageSection[];
  updatedBy?: string;
}

@Injectable()
export class SitePagesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.sitePage.findMany({ orderBy: { slug: 'asc' } });
  }

  async findBySlug(slug: string) {
    return this.prisma.sitePage.findUnique({ where: { slug } });
  }

  async upsert(slug: string, dto: UpsertSitePageDto) {
    return this.prisma.sitePage.upsert({
      where: { slug },
      create: {
        slug,
        title: dto.title,
        sections: JSON.stringify(dto.sections),
        updatedBy: dto.updatedBy,
      },
      update: {
        title: dto.title,
        sections: JSON.stringify(dto.sections),
        updatedBy: dto.updatedBy,
      },
    });
  }

  async delete(slug: string) {
    return this.prisma.sitePage.delete({ where: { slug } });
  }
}
