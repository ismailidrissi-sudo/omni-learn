import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, BadRequestException, Res, NotFoundException,
  ForbiddenException, StreamableFile,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';
import { CertificateService } from './certificate.service';
import { CertificateUrlService } from './certificate-url.service';

@Controller('certificates')
export class CertificateController {
  constructor(
    private readonly certificateService: CertificateService,
    private readonly certificateUrlService: CertificateUrlService,
  ) {}

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

  @Get(':id/download')
  async downloadPdf(
    @Param('id') id: string,
    @Query('sig') sig: string,
    @Query('exp') exp: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!sig || !exp) {
      throw new BadRequestException('Missing sig or exp query parameters');
    }

    const expiresAt = parseInt(exp, 10);
    if (isNaN(expiresAt)) {
      throw new BadRequestException('Invalid exp parameter');
    }

    if (!this.certificateUrlService.validateSignature(id, sig, expiresAt)) {
      throw new ForbiddenException('Invalid or expired signature');
    }

    const storagePath = process.env.CERTIFICATE_STORAGE_PATH || './data/certificates';
    const cert = await this.certificateService.getCertificateDetail(id);
    const issuedAt = cert.issuedAt;
    const year = issuedAt.getFullYear().toString();
    const month = String(issuedAt.getMonth() + 1).padStart(2, '0');
    const filePath = join(storagePath, year, month, `${id}.pdf`);

    if (!existsSync(filePath)) {
      throw new NotFoundException('Certificate PDF not found');
    }

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="certificate-${id}.pdf"`,
    });

    const stream = createReadStream(filePath);
    return new StreamableFile(stream);
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
