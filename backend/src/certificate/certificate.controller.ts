import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { CertificateService } from './certificate.service';

@Controller('certificates')
export class CertificateController {
  constructor(private readonly certificateService: CertificateService) {}

  @Get('templates')
  async getTemplate(
    @Query('tenantId') tenantId: string,
    @Query('domainId') domainId: string,
  ) {
    if (!tenantId || !domainId) {
      throw new Error('tenantId and domainId are required');
    }
    return this.certificateService.getTemplateForDomain(tenantId, domainId);
  }

  @Post('issue')
  async issue(@Body() body: { enrollmentId: string; grade?: string }) {
    return this.certificateService.issueCertificate(body.enrollmentId, body.grade);
  }

  @Get('verify/:code')
  async verify(@Param('code') code: string) {
    return this.certificateService.verifyCertificate(code);
  }

  @Get('user/:userId')
  async getUserCertificates(@Param('userId') userId: string) {
    return this.certificateService.getUserCertificates(userId);
  }
}
