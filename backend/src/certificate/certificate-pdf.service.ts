import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import * as PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import { BrandingResolverService } from '../email/templates/branding-resolver.service';

type Locale = 'en' | 'fr' | 'ar';

const CERT_LABELS: Record<Locale, Record<string, string>> = {
  en: {
    title: 'CERTIFICATE',
    ofCompletion: 'OF COMPLETION',
    certifiesThat: 'This is to certify that',
    completedPath: 'has successfully completed the learning path',
    completedCourse: 'has successfully completed the course',
    issuedOn: 'Issued on {date}',
    verifyAt: 'Verify at',
    verifyCode: 'Verification Code',
    afflatus: 'Omnilearn is a product of Afflatus Consulting Group',
  },
  fr: {
    title: 'CERTIFICAT',
    ofCompletion: 'DE RÉUSSITE',
    certifiesThat: 'Ceci certifie que',
    completedPath: 'a complété avec succès le parcours d\'apprentissage',
    completedCourse: 'a complété avec succès le cours',
    issuedOn: 'Délivré le {date}',
    verifyAt: 'Vérifiez sur',
    verifyCode: 'Code de vérification',
    afflatus: 'Omnilearn est un produit d\'Afflatus Consulting Group',
  },
  ar: {
    title: 'شهادة',
    ofCompletion: 'إتمام',
    certifiesThat: 'يُشهد بأن',
    completedPath: 'قد أتم بنجاح مسار التعلم',
    completedCourse: 'قد أتم بنجاح الدورة التدريبية',
    issuedOn: 'صدر بتاريخ {date}',
    verifyAt: 'تحقق من',
    verifyCode: 'رمز التحقق',
    afflatus: 'Omnilearn هو منتج من Afflatus Consulting Group',
  },
};

const LOCALE_BCP47: Record<Locale, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  ar: 'ar-SA',
};

export interface CertificatePdfData {
  userName: string;
  contentTitle: string;
  contentType: 'course' | 'path';
  completionDate: Date;
  verifyCode: string;
  tenantId?: string | null;
  locale?: Locale;
}

@Injectable()
export class CertificatePdfService {
  private readonly logger = new Logger(CertificatePdfService.name);

  constructor(private readonly brandingResolver: BrandingResolverService) {}

  private buildVerifyUrl(verifyCode: string): string {
    const base = (process.env.FRONTEND_URL || 'https://omnilearn.space').replace(/\/$/, '');
    return `${base}/certificates/verify/${encodeURIComponent(verifyCode)}`;
  }

  private verifyUrlForDisplay(verifyCode: string): string {
    try {
      const u = new URL(this.buildVerifyUrl(verifyCode));
      return `${u.host}${u.pathname}`;
    } catch {
      return `omnilearn.space/certificates/verify/${verifyCode}`;
    }
  }

  private tryReadPngAsset(filename: string): Buffer | null {
    const candidates = [
      join(__dirname, 'assets', filename),
      join(process.cwd(), 'src', 'certificate', 'assets', filename),
      join(process.cwd(), 'frontend', 'public', filename),
      join(process.cwd(), '..', 'frontend', 'public', filename),
    ];
    for (const p of candidates) {
      try {
        if (existsSync(p)) return readFileSync(p);
      } catch {
        /* try next */
      }
    }
    return null;
  }

  private t(locale: Locale, key: string, params?: Record<string, string>): string {
    const labels = CERT_LABELS[locale] ?? CERT_LABELS.en;
    let value = labels[key] ?? CERT_LABELS.en[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        value = value.replace(`{${k}}`, v);
      }
    }
    return value;
  }

  async generatePdf(data: CertificatePdfData): Promise<Buffer> {
    const locale: Locale = data.locale ?? 'en';
    const branding = await this.brandingResolver.resolveForTenant(
      data.tenantId ?? null,
    );

    const primaryColor = branding.primaryColor;
    const secondaryColor = branding.secondaryColor;
    const accentColor = branding.accentColor;
    const textColor = branding.textColor;
    const platformName = branding.platformName;

    let qrPng: Buffer | null = null;
    try {
      qrPng = await QRCode.toBuffer(this.buildVerifyUrl(data.verifyCode), {
        type: 'png',
        width: 200,
        margin: 1,
        color: { dark: primaryColor, light: '#FFFFFF' },
      });
    } catch (e) {
      this.logger.warn(`Certificate QR generation failed: ${e}`);
    }

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

    // Corner ornaments
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

    const omnilearnLogo = this.tryReadPngAsset('omni-learn-logo.png');
    if (omnilearnLogo) {
      try {
        doc.image(omnilearnLogo, borderInset + 10, 38, { width: 54 });
      } catch (e) {
        this.logger.warn(`Certificate OmniLearn logo failed: ${e}`);
      }
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
      .text(this.t(locale, 'title'), 0, 85, { align: 'center', width: pageWidth });

    doc
      .font('Helvetica')
      .fontSize(14)
      .fillColor(textColor)
      .text(this.t(locale, 'ofCompletion'), 0, 125, { align: 'center', width: pageWidth });

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
      .text(this.t(locale, 'certifiesThat'), 0, 175, { align: 'center', width: pageWidth });

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
    const completionKey = data.contentType === 'course' ? 'completedCourse' : 'completedPath';
    doc
      .font('Helvetica')
      .fontSize(12)
      .fillColor(textColor)
      .text(this.t(locale, completionKey), 0, 252, {
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

    // --- Completion date (locale-aware) ---
    const formattedDate = data.completionDate.toLocaleDateString(LOCALE_BCP47[locale], {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor(textColor)
      .text(this.t(locale, 'issuedOn', { date: formattedDate }), 0, 340, {
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

    const qrDrawSize = 76;
    const qrX = borderInset + 12;
    const qrY = 360;
    if (qrPng) {
      try {
        doc.image(qrPng, qrX, qrY, { width: qrDrawSize, height: qrDrawSize });
      } catch (e) {
        this.logger.warn(`Certificate QR embed failed: ${e}`);
      }
    }

    const verifyDisplay = this.verifyUrlForDisplay(data.verifyCode);
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#9CA3AF')
      .text(`${this.t(locale, 'verifyAt')} ${verifyDisplay}`, 0, pageHeight - 58, {
        align: 'center',
        width: pageWidth,
      });

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#9CA3AF')
      .text(`${this.t(locale, 'verifyCode')}: ${data.verifyCode}`, 0, pageHeight - 46, {
        align: 'center',
        width: pageWidth,
      });

    const afflatusText = this.t(locale, 'afflatus');
    const afflatusBuf = this.tryReadPngAsset('afflatus-logo.png');
    const footerBaselineY = pageHeight - 28;
    doc.font('Helvetica').fontSize(7).fillColor('#9CA3AF');
    let afflatusRowDone = false;
    if (afflatusBuf) {
      try {
        const logoW = 9;
        const logoH = 9;
        const tw = doc.widthOfString(afflatusText);
        const total = logoW + 4 + tw;
        const startX = centerX - total / 2;
        doc.image(afflatusBuf, startX, footerBaselineY - logoH + 1, { width: logoW, height: logoH });
        doc.text(afflatusText, startX + logoW + 4, footerBaselineY, { lineBreak: false });
        afflatusRowDone = true;
      } catch (e) {
        this.logger.warn(`Certificate Afflatus logo failed: ${e}`);
      }
    }
    if (!afflatusRowDone) {
      doc.text(afflatusText, 0, footerBaselineY, { align: 'center', width: pageWidth });
    }

    doc.end();

    return finished;
  }
}
