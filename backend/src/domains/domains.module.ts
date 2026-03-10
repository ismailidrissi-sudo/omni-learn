import { Module } from '@nestjs/common';
import { DomainsService } from './domains.service';
import { DomainsController } from './domains.controller';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Domains Module — Dynamic domains (admin-created)
 * Architecture: Section 5 — Domains are NOT enums.
 */
@Module({
  imports: [PrismaModule],
  controllers: [DomainsController],
  providers: [DomainsService],
  exports: [DomainsService],
})
export class DomainsModule {}
