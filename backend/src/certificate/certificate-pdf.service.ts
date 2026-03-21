import { Injectable, Logger } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import { BrandingResolverService } from '../email/templates/branding-resolver.service';

export interface CertificatePdfData {
  userName: string;
  contentTitle: string;
  contentType: 'course' | 'path';
  completionDate: Date;
  verifyCode: string;
  tenantId?: string | null;
}

@Injectable()
export class CertificatePdfService {
  private readonly logger = new Logger(CertificatePdfService.name);

  constructor(private readonly brandingResolver: BrandingResolverService) {}

  async generatePdf(data: CertificatePdfData): Promise<Buffer> {
    const branding = await this.brandingResolver.resolveForTenant(
      data.tenantId ?? null,
    );

    const primaryColor = branding.primaryColor;
    const secondaryColor = branding.secondaryColor;
    const accentColor = branding.accentColor;
    const textColor = branding.textColor;
    const platformName = branding.platformName;

    const pageWidth = 842; // A4 landscape
    const pageHeight = 595;

    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      info: {
        Title: `Certificate — ${data.contentTitle}`,
        Author: platformName,
        Subject: `Certificate of Completion for ${data.userName}`,
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const finished = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    // --- Background ---
    doc.rect(0, 0, pageWidth, pageHeight).fill('#FFFFFF');

    // Decorative border
    const borderInset = 20;
    doc
      .rect(borderInset, borderInset, pageWidth - borderInset * 2, pageHeight - borderInset * 2)
      .lineWidth(2)
      .stroke(primaryColor);

    doc
      .rect(borderInset + 6, borderInset + 6, pageWidth - (borderInset + 6) * 2, pageHeight - (borderInset + 6) * 2)
      .lineWidth(0.5)
      .stroke(accentColor);

    // Top accent bar
    doc.rect(borderInset, borderInset, pageWidth - borderInset * 2, 8).fill(primaryColor);

    // Bottom accent bar
    doc
      .rect(borderInset, pageHeight - borderInset - 8, pageWidth - borderInset * 2, 8)
      .fill(primaryColor);

    // Corner ornaments (small squares)
    const ornamentSize = 14;
    const corners = [
      [borderInset, borderInset],
      [pageWidth - borderInset - ornamentSize, borderInset],
      [borderInset, pageHeight - borderInset - ornamentSize],
      [pageWidth - borderInset - ornamentSize, pageHeight - borderInset - ornamentSize],
    ];
    for (const [cx, cy] of corners) {
      doc.rect(cx, cy, ornamentSize, ornamentSize).fill(accentColor);
    }

    const centerX = pageWidth / 2;

    // --- Platform name ---
    doc
      .font('Helvetica')
      .fontSize(12)
      .fillColor(secondaryColor)
      .text(platformName.toUpperCase(), 0, 55, { align: 'center', width: pageWidth });

    // --- Title ---
    doc
      .font('Helvetica-Bold')
      .fontSize(34)
      .fillColor(primaryColor)
      .text('CERTIFICATE', 0, 85, { align: 'center', width: pageWidth });

    doc
      .font('Helvetica')
      .fontSize(14)
      .fillColor(textColor)
      .text('OF COMPLETION', 0, 125, { align: 'center', width: pageWidth });

    // Decorative line under title
    const lineY = 152;
    doc
      .moveTo(centerX - 120, lineY)
      .lineTo(centerX + 120, lineY)
      .lineWidth(1.5)
      .stroke(accentColor);

    // --- "This certifies that" ---
    doc
      .font('Helvetica')
      .fontSize(12)
      .fillColor(textColor)
      .text('This certifies that', 0, 175, { align: 'center', width: pageWidth });

    // --- User name ---
    doc
      .font('Helvetica-Bold')
      .fontSize(28)
      .fillColor(secondaryColor)
      .text(data.userName, 0, 200, { align: 'center', width: pageWidth });

    // Underline beneath name
    const nameWidth = doc.widthOfString(data.userName);
    const nameLineY = 234;
    doc
      .moveTo(centerX - nameWidth / 2 - 20, nameLineY)
      .lineTo(centerX + nameWidth / 2 + 20, nameLineY)
      .lineWidth(0.75)
      .stroke(accentColor);

    // --- "has successfully completed" ---
    doc
      .font('Helvetica')
      .fontSize(12)
      .fillColor(textColor)
      .text('has successfully completed the following ' + data.contentType, 0, 252, {
        align: 'center',
        width: pageWidth,
      });

    // --- Content title ---
    doc
      .font('Helvetica-Bold')
      .fontSize(20)
      .fillColor(primaryColor)
      .text(data.contentTitle, 60, 282, {
        align: 'center',
        width: pageWidth - 120,
      });

    // --- Completion date ---
    const formattedDate = data.completionDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor(textColor)
      .text(`Completed on ${formattedDate}`, 0, 340, {
        align: 'center',
        width: pageWidth,
      });

    // --- Decorative separator ---
    const sepY = 370;
    doc
      .moveTo(centerX - 80, sepY)
      .lineTo(centerX - 10, sepY)
      .lineWidth(0.5)
      .stroke(accentColor);
    doc
      .moveTo(centerX + 10, sepY)
      .lineTo(centerX + 80, sepY)
      .lineWidth(0.5)
      .stroke(accentColor);

    // Diamond in center of separator
    doc
      .save()
      .translate(centerX, sepY)
      .rotate(45)
      .rect(-3, -3, 6, 6)
      .fill(accentColor)
      .restore();

    // --- Signature line ---
    const sigLineY = 460;
    doc
      .moveTo(centerX - 100, sigLineY)
      .lineTo(centerX + 100, sigLineY)
      .lineWidth(0.75)
      .stroke(textColor);

    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(textColor)
      .text(platformName, 0, sigLineY + 6, { align: 'center', width: pageWidth });

    // --- Verify code (bottom) ---
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#9CA3AF')
      .text(`Verification Code: ${data.verifyCode}`, 0, pageHeight - 50, {
        align: 'center',
        width: pageWidth,
      });

    doc.end();

    return finished;
  }
}
