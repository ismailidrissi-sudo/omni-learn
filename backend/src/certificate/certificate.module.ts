import { Module } from '@nestjs/common';
import { CertificateController } from './certificate.controller';
import { CertificateService } from './certificate.service';
import { CertificatePdfService } from './certificate-pdf.service';
import { CertificateUrlService } from './certificate-url.service';
import { DomainsModule } from '../domains/domains.module';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [DomainsModule, AuthModule, EmailModule],
  controllers: [CertificateController],
  providers: [CertificateService, CertificatePdfService, CertificateUrlService],
  exports: [CertificateService, CertificateUrlService],
})
export class CertificateModule {}
