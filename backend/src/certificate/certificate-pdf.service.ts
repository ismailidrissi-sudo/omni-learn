import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import * as PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import { BrandingResolverService } from '../email/templates/branding-resolver.service';

type Locale = 'en' | 'fr' | 'ar';

const CERT_LABELS: Record<Locale, Record<string, string>> = {
  en: {
    title: 'CERTIFICATE OF COMPLETION',
    certifiesThat: 'This is to certify that',
    completedPath: 'has successfully completed the learning path',
    completedCourse: 'has successfully completed the course',
    domain: 'Domain',
    grade: 'Grade',
    learningHours: 'Total learning time: {hours} hours',
    issuedOn: 'Issued on {date}',
    verifyAt: 'Verify at',
    code: 'Code',
    sealCertified: 'CERTIFIED',
    sealProfessional: 'PROFESSIONAL',
    afflatus: 'Omnilearn is a product of Afflatus Consulting Group',
  },
  fr: {
    title: 'CERTIFICAT DE RÉUSSITE',
    certifiesThat: 'Ceci certifie que',
    completedPath: "a complété avec succès le parcours d'apprentissage",
    completedCourse: 'a complété avec succès le cours',
    domain: 'Domaine',
    grade: 'Note',
    learningHours: "Temps total d'apprentissage : {hours} heures",
    issuedOn: 'Délivré le {date}',
    verifyAt: 'Vérifier sur',
    code: 'Code',
    sealCertified: 'CERTIFIÉ',
    sealProfessional: 'PROFESSIONNEL',
    afflatus: "Omnilearn est un produit d'Afflatus Consulting Group",
  },
  ar: {
    title: 'شهادة إتمام',
    certifiesThat: 'يُشهد بأن',
    completedPath: 'قد أتم بنجاح مسار التعلم',
    completedCourse: 'قد أتم بنجاح الدورة التدريبية',
    domain: 'المجال',
    grade: 'الدرجة',
    learningHours: 'إجمالي وقت التعلم: {hours} ساعات',
    issuedOn: 'صدر بتاريخ {date}',
    verifyAt: 'تحقق على',
    code: 'الرمز',
    sealCertified: 'مُعتمد',
    sealProfessional: 'محترف',
    afflatus: 'Omnilearn هو منتج من Afflatus Consulting Group',
  },
};

const LOCALE_BCP47: Record<Locale, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  ar: 'ar-SA',
};

interface ThemeConfig {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  seal_text?: string;
}

interface ElementsConfig {
  show_logo: boolean;
  show_qr: boolean;
  show_hours: boolean;
  show_grade: boolean;
  show_signature: boolean;
  show_seal: boolean;
}

interface Signatory {
  name: string;
  title: string;
  signatureImage?: string;
}

export interface CertificatePdfData {
  userName: string;
  contentTitle: string;
  contentType: 'course' | 'path';
  completionDate: Date;
  verifyCode: string;
  tenantId?: string | null;
  locale?: Locale;
  domainName?: string;
  grade?: string | null;
  totalLearningMinutes?: number;
  tenantName?: string;
  themeConfig?: Partial<ThemeConfig> | null;
  elementsConfig?: Partial<ElementsConfig> | null;
  signatories?: Signatory[];
}

const DEFAULT_THEME: ThemeConfig = {
  primary_color: '#059669',
  secondary_color: '#10b981',
  accent_color: '#c8a951',
};

const DEFAULT_ELEMENTS: ElementsConfig = {
  show_logo: true,
  show_qr: true,
  show_hours: true,
  show_grade: true,
  show_signature: true,
  show_seal: true,
};

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 0, 0];
}

function parseJsonSafe<T>(val: unknown, fallback: T): T {
  if (val == null) return fallback;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  }
  return (val as T) ?? fallback;
}

/** mm → PDFKit points (A4 landscape: 297mm = 842pt) */
const MM = 842 / 297;

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
      join(__dirname, '..', 'certificate', 'assets', filename),
      join(process.cwd(), 'dist', 'certificate', 'assets', filename),
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
    this.logger.warn(
      `Asset "${filename}" not found in any candidate path: ${candidates.join(', ')}`,
    );
    return null;
  }

  private async tryFetchImage(url: string): Promise<Buffer | null> {
    if (!url) return null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch {
      return null;
    }
  }

  private t(locale: Locale, key: string, params?: Record<string, string | number>): string {
    const labels = CERT_LABELS[locale] ?? CERT_LABELS.en;
    let value = labels[key] ?? CERT_LABELS.en[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        value = value.replace(`{${k}}`, String(v));
      }
    }
    return value;
  }

  private drawArcText(
    doc: PDFKit.PDFDocument,
    text: string,
    cx: number,
    cy: number,
    radius: number,
    startAngleDeg: number,
    endAngleDeg: number,
    color: string,
    fontSize: number,
  ) {
    const chars = text.split('');
    if (chars.length === 0) return;
    const totalAngle = endAngleDeg - startAngleDeg;
    const step = totalAngle / Math.max(chars.length - 1, 1);

    doc.font('Helvetica-Bold').fontSize(fontSize).fillColor(color);

    for (let i = 0; i < chars.length; i++) {
      const angleDeg = startAngleDeg + step * i;
      const angleRad = (angleDeg * Math.PI) / 180;
      const x = cx + radius * Math.cos(angleRad);
      const y = cy - radius * Math.sin(angleRad);

      doc.save();
      doc.translate(x, y);
      doc.rotate(-(angleDeg - 90));
      const cw = doc.widthOfString(chars[i]);
      doc.text(chars[i], -cw / 2, -fontSize / 2, { lineBreak: false });
      doc.restore();
    }
  }

  async generatePdf(data: CertificatePdfData): Promise<Buffer> {
    const locale: Locale = data.locale ?? 'en';
    const isRtl = locale === 'ar';
    const branding = await this.brandingResolver.resolveForTenant(data.tenantId ?? null);

    const themeRaw = parseJsonSafe<Partial<ThemeConfig>>(data.themeConfig, {});
    const theme: ThemeConfig = { ...DEFAULT_THEME, ...themeRaw };
    const elements: ElementsConfig = {
      ...DEFAULT_ELEMENTS,
      ...parseJsonSafe<Partial<ElementsConfig>>(data.elementsConfig, {}),
    };
    const signatories = parseJsonSafe<Signatory[]>(data.signatories, []);

    const primary = hexToRgb(theme.primary_color);
    const secondary = hexToRgb(theme.secondary_color);
    const accent = hexToRgb(theme.accent_color);
    const platformName = data.tenantName || branding.platformName;

    const W = 842;
    const H = 595;

    // Pre-load images in parallel
    const [omnilearnLogo, afflatusLogo, qrPng, ...sigImages] = await Promise.all([
      elements.show_logo
        ? Promise.resolve(this.tryReadPngAsset('omni-learn-logo.png'))
        : Promise.resolve(null),
      Promise.resolve(this.tryReadPngAsset('afflatus-logo.png')),
      elements.show_qr
        ? QRCode.toBuffer(this.buildVerifyUrl(data.verifyCode), {
            type: 'png',
            width: 200,
            margin: 1,
            color: { dark: theme.primary_color, light: '#FFFFFF' },
          }).catch((e) => {
            this.logger.warn(`QR generation failed: ${e}`);
            return null as Buffer | null;
          })
        : Promise.resolve(null),
      ...signatories.map((s) =>
        s.signatureImage ? this.tryFetchImage(s.signatureImage) : Promise.resolve(null),
      ),
    ]);

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

    // ─── Background ──────────────────────────────────────────────────
    doc.rect(0, 0, W, H).fill('#FFFFFF');

    // Top gradient band (primary → secondary)
    const gradientSteps = 60;
    const bandH = MM * 5;
    for (let i = 0; i < gradientSteps; i++) {
      const t = i / gradientSteps;
      const r = Math.round(primary[0] + (secondary[0] - primary[0]) * t);
      const g = Math.round(primary[1] + (secondary[1] - primary[1]) * t);
      const b = Math.round(primary[2] + (secondary[2] - primary[2]) * t);
      doc.rect((W / gradientSteps) * i, 0, W / gradientSteps + 0.5, bandH).fill(
        `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`,
      );
    }

    // Bottom accent line
    doc.rect(0, H - MM * 3, W, MM * 3).fill(
      `rgb(${accent[0]}, ${accent[1]}, ${accent[2]})`,
    );

    // Decorative borders
    const outer = MM * 12;
    doc.rect(outer, outer, W - outer * 2, H - outer * 2).lineWidth(2.2).stroke(
      `rgb(${primary[0]}, ${primary[1]}, ${primary[2]})`,
    );
    const inner = MM * 15;
    doc.rect(inner, inner, W - inner * 2, H - inner * 2).lineWidth(0.8).stroke(
      `rgb(${accent[0]}, ${accent[1]}, ${accent[2]})`,
    );

    // Corner ornament circles
    const co = MM * 18;
    const cornerR = MM * 1.5;
    const corners: [number, number][] = [
      [co, co],
      [W - co, co],
      [co, H - co],
      [W - co, H - co],
    ];
    for (const [cx, cy] of corners) {
      doc
        .circle(cx, cy, cornerR)
        .fill(`rgb(${accent[0]}, ${accent[1]}, ${accent[2]})`);
    }

    // ─── Logo ────────────────────────────────────────────────────────
    const logoW = MM * 22;
    if (elements.show_logo && omnilearnLogo) {
      const logoX = isRtl ? W - MM * 20 - logoW : MM * 20;
      const logoY = MM * 16;
      try {
        doc.image(omnilearnLogo, logoX, logoY, { width: logoW });
      } catch (e) {
        this.logger.warn(`Logo embed failed: ${e}`);
      }
    }

    let y = MM * 30;

    // ─── Organization name ───────────────────────────────────────────
    if (platformName) {
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#787878')
        .text(platformName.toUpperCase(), 0, y, { align: 'center', width: W });
      y += MM * 8;
    }

    // ─── Title ───────────────────────────────────────────────────────
    doc
      .font('Helvetica-Bold')
      .fontSize(26)
      .fillColor(`rgb(${primary[0]}, ${primary[1]}, ${primary[2]})`)
      .text(this.t(locale, 'title'), 0, y, { align: 'center', width: W });
    y += MM * 6;

    // Decorative line under title
    const lineW = MM * 80;
    doc
      .moveTo(W / 2 - lineW / 2, y)
      .lineTo(W / 2 + lineW / 2, y)
      .lineWidth(1.4)
      .stroke(`rgb(${accent[0]}, ${accent[1]}, ${accent[2]})`);
    y += MM * 12;

    // ─── "This is to certify that" ──────────────────────────────────
    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor('#646464')
      .text(this.t(locale, 'certifiesThat'), 0, y, { align: 'center', width: W });
    y += MM * 12;

    // ─── Recipient name ──────────────────────────────────────────────
    doc
      .font('Helvetica-Bold')
      .fontSize(24)
      .fillColor('#282828')
      .text(data.userName, 0, y, { align: 'center', width: W });
    y += MM * 5;

    const nameWidth = doc.widthOfString(data.userName);
    doc
      .moveTo(W / 2 - nameWidth / 2 - MM * 5, y)
      .lineTo(W / 2 + nameWidth / 2 + MM * 5, y)
      .lineWidth(1)
      .stroke(`rgb(${primary[0]}, ${primary[1]}, ${primary[2]})`);
    y += MM * 10;

    // ─── "has successfully completed …" ──────────────────────────────
    const completionKey = data.contentType === 'course' ? 'completedCourse' : 'completedPath';
    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor('#646464')
      .text(this.t(locale, completionKey), 0, y, { align: 'center', width: W });
    y += MM * 10;

    // ─── Content title ───────────────────────────────────────────────
    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .fillColor(`rgb(${primary[0]}, ${primary[1]}, ${primary[2]})`)
      .text(data.contentTitle, MM * 20, y, { align: 'center', width: W - MM * 40 });
    y += MM * 7;

    // ─── Domain ──────────────────────────────────────────────────────
    if (data.domainName) {
      doc
        .font('Helvetica')
        .fontSize(12)
        .fillColor('#505050')
        .text(`${this.t(locale, 'domain')}: ${data.domainName}`, 0, y, {
          align: 'center',
          width: W,
        });
      y += MM * 8;
    }

    // ─── Grade ───────────────────────────────────────────────────────
    if (elements.show_grade && data.grade) {
      doc
        .font('Helvetica-Bold')
        .fontSize(13)
        .fillColor(`rgb(${accent[0]}, ${accent[1]}, ${accent[2]})`)
        .text(`${this.t(locale, 'grade')}: ${data.grade}`, 0, y, {
          align: 'center',
          width: W,
        });
      y += MM * 7;
    }

    // ─── Learning hours ──────────────────────────────────────────────
    if (
      elements.show_hours &&
      data.totalLearningMinutes != null &&
      data.totalLearningMinutes > 0
    ) {
      const hours = Math.round((data.totalLearningMinutes / 60) * 10) / 10;
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#646464')
        .text(this.t(locale, 'learningHours', { hours }), 0, y, {
          align: 'center',
          width: W,
        });
      y += MM * 7;
    }

    // ─── Issued date ─────────────────────────────────────────────────
    const formattedDate = data.completionDate.toLocaleDateString(LOCALE_BCP47[locale], {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#646464')
      .text(this.t(locale, 'issuedOn', { date: formattedDate }), 0, y, {
        align: 'center',
        width: W,
      });

    // ─── Circular seal ───────────────────────────────────────────────
    if (elements.show_seal) {
      const sealX = isRtl ? MM * 55 : W - MM * 55;
      const sealY = H - MM * 55;
      const outerR = MM * 17;
      const innerR = MM * 14;
      const accentHex = theme.accent_color;

      doc
        .circle(sealX, sealY, outerR)
        .lineWidth(3.4)
        .stroke(`rgb(${accent[0]}, ${accent[1]}, ${accent[2]})`);
      doc
        .circle(sealX, sealY, innerR)
        .lineWidth(1.1)
        .stroke(`rgb(${accent[0]}, ${accent[1]}, ${accent[2]})`);

      const arcFontSize = MM * 2;
      const arcRadius = innerR - MM * 2.5;
      const sealDomain = (data.domainName || '').toUpperCase();
      const topArc = `${this.t(locale, 'sealCertified')} ${sealDomain}`;
      const bottomArc = this.t(locale, 'sealProfessional');

      this.drawArcText(doc, topArc, sealX, sealY, arcRadius, 150, 30, accentHex, arcFontSize);
      this.drawArcText(doc, bottomArc, sealX, sealY, arcRadius, 210, 330, accentHex, arcFontSize);

      doc
        .circle(sealX, sealY, MM * 1.2)
        .fill(`rgb(${accent[0]}, ${accent[1]}, ${accent[2]})`);
    }

    // ─── QR Code ─────────────────────────────────────────────────────
    if (elements.show_qr && qrPng) {
      const qrSize = MM * 22;
      const qrX = isRtl ? W - MM * 20 - qrSize : MM * 20;
      const qrY = H - MM * 55;
      try {
        doc.image(qrPng, qrX, qrY, { width: qrSize, height: qrSize });
      } catch (e) {
        this.logger.warn(`QR embed failed: ${e}`);
      }
    }

    // ─── Signatories ─────────────────────────────────────────────────
    if (elements.show_signature && signatories.length > 0) {
      const sigY = H - MM * 42;
      const sigSpacing = MM * 70;
      const startX = W / 2 - ((signatories.length - 1) * sigSpacing) / 2;

      for (let i = 0; i < signatories.length; i++) {
        const sig = signatories[i];
        const sx = startX + i * sigSpacing;

        const imgBuf = sigImages[i];
        if (imgBuf) {
          try {
            doc.image(imgBuf, sx - MM * 15, sigY - MM * 18, {
              width: MM * 30,
              height: MM * 14,
            });
          } catch {
            /* skip invalid image */
          }
        }

        doc
          .moveTo(sx - MM * 25, sigY)
          .lineTo(sx + MM * 25, sigY)
          .lineWidth(0.8)
          .stroke('#969696');

        doc
          .font('Helvetica-Bold')
          .fontSize(10)
          .fillColor('#282828')
          .text(sig.name, sx - MM * 30, sigY + MM * 2, {
            align: 'center',
            width: MM * 60,
          });

        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor('#646464')
          .text(sig.title, sx - MM * 30, sigY + MM * 6, {
            align: 'center',
            width: MM * 60,
          });
      }
    }

    // ─── Verification text ───────────────────────────────────────────
    const verifyDisplay = this.verifyUrlForDisplay(data.verifyCode);
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor('#969696')
      .text(`${this.t(locale, 'verifyAt')} ${verifyDisplay}`, 0, H - MM * 17, {
        align: 'center',
        width: W,
      });
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor('#969696')
      .text(`${this.t(locale, 'code')}: ${data.verifyCode}`, 0, H - MM * 13, {
        align: 'center',
        width: W,
      });

    // ─── Afflatus footer ─────────────────────────────────────────────
    const afflatusText = this.t(locale, 'afflatus');
    const footerY = H - MM * 7;
    doc.font('Helvetica').fontSize(6.5).fillColor('#828282');

    const afflatusBuf = afflatusLogo;
    if (afflatusBuf) {
      try {
        const logoSize = MM * 3;
        const tw = doc.widthOfString(afflatusText);
        const total = logoSize + 4 + tw;
        const startX = W / 2 - total / 2;
        doc.image(afflatusBuf, startX, footerY - logoSize + 1, {
          width: logoSize,
          height: logoSize,
        });
        doc.text(afflatusText, startX + logoSize + 4, footerY, { lineBreak: false });
      } catch (e) {
        this.logger.warn(`Afflatus logo embed failed: ${e}`);
        doc.text(afflatusText, 0, footerY, { align: 'center', width: W });
      }
    } else {
      doc.text(afflatusText, 0, footerY, { align: 'center', width: W });
    }

    doc.end();
    return finished;
  }
}
