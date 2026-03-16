import { Module } from '@nestjs/common';
import { CertificateController } from './certificate.controller';
import { CertificateService } from './certificate.service';
import { DomainsModule } from '../domains/domains.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DomainsModule, AuthModule],
  controllers: [CertificateController],
  providers: [CertificateService],
  exports: [CertificateService],
})
export class CertificateModule {}
