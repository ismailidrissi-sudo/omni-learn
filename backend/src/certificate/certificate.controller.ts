import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CertificateService } from './certificate.service';

@Controller('certificates')
export class CertificateController {
  constructor(private readonly certificateService: CertificateService) {}

  @Get('templates')
  @UseGuards(AuthGuard('jwt'))
  async getTemplate(
    @Query('tenantId') tenantId: string,
    @Query('domainId') domainId: string,
  ) {
    if (!tenantId || !domainId) {
      throw new BadRequestException('tenantId and domainId are required');
    }
    return this.certificateService.getTemplateForDomain(tenantId, domainId);
  }

  @Get('templates/all')
  @UseGuards(AuthGuard('jwt'))
  async getAllTemplates(@Query('tenantId') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('tenantId is required');
    }
    return this.certificateService.getAllTemplatesForTenant(tenantId);
  }

  @Patch('templates/:id')
  @UseGuards(AuthGuard('jwt'))
  async updateTemplate(
    @Param('id') id: string,
    @Body() body: {
      templateName?: string;
      themeConfig?: Record<string, unknown>;
      elementsConfig?: Record<string, unknown>;
      signatories?: Array<{ name: string; title: string }>;
    },
  ) {
    return this.certificateService.updateTemplate(id, body);
  }

  @Post('issue')
  @UseGuards(AuthGuard('jwt'))
  async issue(@Body() body: { enrollmentId: string; grade?: string }) {
    return this.certificateService.issueCertificate(body.enrollmentId, body.grade);
  }

  @Post('issue-course')
  @UseGuards(AuthGuard('jwt'))
  async issueCourse(@Body() body: { courseEnrollmentId: string; grade?: string }) {
    return this.certificateService.issueCourseEnrollmentCertificate(body.courseEnrollmentId, body.grade);
  }

  @Post('backfill')
  @UseGuards(AuthGuard('jwt'))
  async backfillMissing() {
    return this.certificateService.backfillMissingCertificates();
  }

  @Get('verify/:code')
  async verify(@Param('code') code: string) {
    return this.certificateService.verifyCertificate(code);
  }

  @Get('detail/:id')
  @UseGuards(AuthGuard('jwt'))
  async getCertificateDetail(@Param('id') id: string) {
    return this.certificateService.getCertificateDetail(id);
  }

  @Get('user/:userId')
  @UseGuards(AuthGuard('jwt'))
  async getUserCertificates(@Param('userId') userId: string) {
    return this.certificateService.getUserCertificates(userId);
  }
}
