import jsPDF from "jspdf";
import QRCode from "qrcode";
import en from "./i18n/translations/en.json";
import fr from "./i18n/translations/fr.json";
import ar from "./i18n/translations/ar.json";
import { getOmnilearnLogo, getAfflatusLogo, loadSignatureImage } from "./certificate-assets";

type Locale = "en" | "fr" | "ar";

interface ThemeConfig {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  seal_text: string;
  title_font: string;
  body_font: string;
}

interface ElementsConfig {
  show_logo: boolean;
  show_qr: boolean;
  show_hours: boolean;
  show_grade: boolean;
  show_signature: boolean;
  show_seal: boolean;
  show_expiry: boolean;
  show_badge: boolean;
}

interface Signatory {
  name: string;
  title: string;
  signatureImage?: string;
}

export interface CertificateData {
  userName: string;
  pathName: string;
  domainName: string;
  domainIcon?: string;
  verifyCode: string;
  grade?: string | null;
  issuedAt: string;
  totalLearningMinutes?: number;
  themeConfig: Partial<ThemeConfig> | ThemeConfig;
  elementsConfig: Partial<ElementsConfig> | ElementsConfig;
  signatories: Signatory[];
  tenantName?: string;
  certType?: "path" | "course";
  locale?: Locale;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 0, 0];
}

const DEFAULT_THEME: ThemeConfig = {
  primary_color: "#059669",
  secondary_color: "#10b981",
  accent_color: "#c8a951",
  seal_text: "CERTIFIED PROFESSIONAL",
  title_font: "Playfair Display",
  body_font: "Source Serif 4",
};

const DEFAULT_ELEMENTS: ElementsConfig = {
  show_logo: true,
  show_qr: true,
  show_hours: true,
  show_grade: true,
  show_signature: true,
  show_seal: true,
  show_expiry: false,
  show_badge: false,
};

function parseJson<T>(val: unknown, fallback: T): T {
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  }
  return (val as T) ?? fallback;
}

// ---------------------------------------------------------------------------
// i18n helpers for certificate PDF labels
// ---------------------------------------------------------------------------

type TranslationMap = Record<string, unknown>;

const translations: Record<Locale, TranslationMap> = {
  en: en as TranslationMap,
  fr: fr as TranslationMap,
  ar: ar as TranslationMap,
};

function getNested(obj: TranslationMap, path: string): string | undefined {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as TranslationMap)[key];
  }
  return typeof current === "string" ? current : undefined;
}

function createT(locale: Locale) {
  const map = translations[locale] ?? translations.en;
  return (key: string, params?: Record<string, string | number>): string => {
    const raw =
      getNested(map, `certificatePdf.${key}`) ??
      getNested(translations.en, `certificatePdf.${key}`) ??
      key;
    if (!params) return raw;
    return raw.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
  };
}

const LOCALE_BCP47: Record<Locale, string> = {
  en: "en-US",
  fr: "fr-FR",
  ar: "ar-SA",
};

function formatDate(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleDateString(LOCALE_BCP47[locale], {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Arc text helper — draws characters along a circular arc
// ---------------------------------------------------------------------------

function drawArcText(
  doc: jsPDF,
  text: string,
  cx: number,
  cy: number,
  radius: number,
  startAngleDeg: number,
  endAngleDeg: number,
) {
  const chars = text.split("");
  if (chars.length === 0) return;
  const totalAngle = endAngleDeg - startAngleDeg;
  const step = totalAngle / Math.max(chars.length - 1, 1);

  chars.forEach((ch, i) => {
    const angleDeg = startAngleDeg + step * i;
    const angleRad = (angleDeg * Math.PI) / 180;
    const x = cx + radius * Math.cos(angleRad);
    const y = cy + radius * Math.sin(angleRad);

    doc.saveGraphicsState();
    const rotDeg = angleDeg + 90;
    doc.text(ch, x, y, { align: "center", angle: -rotDeg });
    doc.restoreGraphicsState();
  });
}

// ---------------------------------------------------------------------------
// Main generator (async — QR + image loading)
// ---------------------------------------------------------------------------

export async function generateCertificatePdf(data: CertificateData): Promise<jsPDF> {
  const locale: Locale = data.locale ?? "en";
  const isRtl = locale === "ar";
  const t = createT(locale);

  const theme = { ...DEFAULT_THEME, ...parseJson(data.themeConfig, {} as Partial<ThemeConfig>) };
  const elements = { ...DEFAULT_ELEMENTS, ...parseJson(data.elementsConfig, {} as Partial<ElementsConfig>) };
  const signatories = parseJson<Signatory[]>(data.signatories, []);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297;
  const H = 210;

  const primary = hexToRgb(theme.primary_color);
  const secondary = hexToRgb(theme.secondary_color);
  const accent = hexToRgb(theme.accent_color);

  // Pre-load images in parallel
  const [omnilearnLogoData, afflatusLogoData, qrDataUrl, ...sigImages] = await Promise.all([
    elements.show_logo ? getOmnilearnLogo() : Promise.resolve(""),
    getAfflatusLogo(),
    elements.show_qr
      ? QRCode.toDataURL(`https://omnilearn.space/certificates/verify/${data.verifyCode}`, {
          width: 200,
          margin: 1,
          color: { dark: theme.primary_color, light: "#FFFFFF" },
        })
      : Promise.resolve(""),
    ...signatories.map((s) => (s.signatureImage ? loadSignatureImage(s.signatureImage) : Promise.resolve(""))),
  ]);

  // =========================================================================
  // Background
  // =========================================================================

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, W, H, "F");

  // Top gradient band
  const gradientSteps = 60;
  for (let i = 0; i < gradientSteps; i++) {
    const tVal = i / gradientSteps;
    const r = Math.round(primary[0] + (secondary[0] - primary[0]) * tVal);
    const g = Math.round(primary[1] + (secondary[1] - primary[1]) * tVal);
    const b = Math.round(primary[2] + (secondary[2] - primary[2]) * tVal);
    doc.setFillColor(r, g, b);
    doc.rect((W / gradientSteps) * i, 0, W / gradientSteps + 0.5, 5, "F");
  }

  // Bottom accent line
  doc.setFillColor(...accent);
  doc.rect(0, H - 3, W, 3, "F");

  // Decorative border
  doc.setDrawColor(...primary);
  doc.setLineWidth(0.8);
  doc.rect(12, 12, W - 24, H - 24);
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.3);
  doc.rect(15, 15, W - 30, H - 30);

  // Corner ornaments
  const corners = [
    [18, 18],
    [W - 18, 18],
    [18, H - 18],
    [W - 18, H - 18],
  ];
  doc.setFillColor(...accent);
  for (const [cx, cy] of corners) {
    doc.circle(cx, cy, 1.5, "F");
  }

  // =========================================================================
  // Logo — top-left (LTR) or top-right (RTL)
  // =========================================================================

  const logoW = 28;
  const logoH = 28;
  if (elements.show_logo && omnilearnLogoData) {
    const logoX = isRtl ? W - 20 - logoW : 20;
    const logoY = 16;
    try {
      doc.addImage(omnilearnLogoData, "PNG", logoX, logoY, logoW, logoH);
    } catch {
      // Fallback: no logo rendered if image is invalid
    }
  }

  let y = 30;

  // =========================================================================
  // Organization name
  // =========================================================================

  if (data.tenantName) {
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.setFont("helvetica", "normal");
    doc.text(data.tenantName.toUpperCase(), W / 2, y, { align: "center" });
    y += 8;
  }

  // =========================================================================
  // Title
  // =========================================================================

  doc.setFontSize(28);
  doc.setTextColor(...primary);
  doc.setFont("helvetica", "bold");
  doc.text(t("title"), W / 2, y, { align: "center" });
  y += 6;

  // Decorative line under title
  const lineW = 80;
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.5);
  doc.line(W / 2 - lineW / 2, y, W / 2 + lineW / 2, y);
  y += 12;

  // =========================================================================
  // "This is to certify that"
  // =========================================================================

  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");
  doc.text(t("certifiesThat"), W / 2, y, { align: "center" });
  y += 12;

  // =========================================================================
  // Recipient Name
  // =========================================================================

  doc.setFontSize(26);
  doc.setTextColor(40, 40, 40);
  doc.setFont("helvetica", "bold");
  doc.text(data.userName, W / 2, y, { align: "center" });
  y += 5;

  const nameWidth = doc.getTextWidth(data.userName);
  doc.setDrawColor(...primary);
  doc.setLineWidth(0.4);
  doc.line(W / 2 - nameWidth / 2 - 5, y, W / 2 + nameWidth / 2 + 5, y);
  y += 10;

  // =========================================================================
  // "has successfully completed the …"
  // =========================================================================

  const completionLabel = data.certType === "course" ? t("completedCourse") : t("completedPath");
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");
  doc.text(completionLabel, W / 2, y, { align: "center" });
  y += 10;

  // =========================================================================
  // Path / Course Name
  // =========================================================================

  doc.setFontSize(18);
  doc.setTextColor(...primary);
  doc.setFont("helvetica", "bold");
  doc.text(data.pathName, W / 2, y, { align: "center" });
  y += 7;

  // =========================================================================
  // Domain
  // =========================================================================

  doc.setFontSize(12);
  doc.setTextColor(80, 80, 80);
  doc.setFont("helvetica", "normal");
  doc.text(`${t("domain")}: ${data.domainName}`, W / 2, y, { align: "center" });
  y += 8;

  // =========================================================================
  // Grade (conditional)
  // =========================================================================

  if (elements.show_grade && data.grade) {
    doc.setFontSize(13);
    doc.setTextColor(...accent);
    doc.setFont("helvetica", "bold");
    doc.text(`${t("grade")}: ${data.grade}`, W / 2, y, { align: "center" });
    y += 7;
  }

  // =========================================================================
  // Learning hours (conditional)
  // =========================================================================

  if (elements.show_hours && data.totalLearningMinutes && data.totalLearningMinutes > 0) {
    const hours = Math.round((data.totalLearningMinutes / 60) * 10) / 10;
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "normal");
    doc.text(t("learningHours", { hours }), W / 2, y, { align: "center" });
    y += 7;
  }

  // =========================================================================
  // Date
  // =========================================================================

  const dateStr = formatDate(data.issuedAt, locale);
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");
  doc.text(t("issuedOn", { date: dateStr }), W / 2, y, { align: "center" });
  y += 5;

  // =========================================================================
  // Circular Seal — bottom-right (LTR) or bottom-left (RTL)
  // =========================================================================

  if (elements.show_seal) {
    const sealX = isRtl ? 55 : W - 55;
    const sealY = H - 55;
    const outerR = 17;
    const innerR = 14;

    doc.setDrawColor(...accent);
    doc.setLineWidth(1.2);
    doc.circle(sealX, sealY, outerR);
    doc.setLineWidth(0.4);
    doc.circle(sealX, sealY, innerR);

    doc.setFontSize(5.5);
    doc.setTextColor(...accent);
    doc.setFont("helvetica", "bold");

    // Resolve seal text: "CERTIFIED [DOMAIN] PROFESSIONAL" translated
    const sealDomain = data.domainName.toUpperCase();
    const topArc = `${t("sealCertified")} ${sealDomain}`;
    const bottomArc = t("sealProfessional");

    // Top arc: text along upper semicircle (-210° to -330°)
    drawArcText(doc, topArc, sealX, sealY, innerR - 2.5, -210, -330);

    // Bottom arc: text along lower semicircle (-150° to -30°)
    drawArcText(doc, bottomArc, sealX, sealY, innerR - 2.5, -150, -30);

    // Center decorative star
    doc.setFillColor(...accent);
    doc.circle(sealX, sealY, 1.2, "F");
  }

  // =========================================================================
  // QR Code — opposite side from seal
  // =========================================================================

  if (elements.show_qr && qrDataUrl) {
    const qrSize = 22;
    const qrX = isRtl ? W - 20 - qrSize : 20;
    const qrY = H - 55;
    try {
      doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
    } catch {
      // Fallback: skip QR if image rendering fails
    }
  }

  // =========================================================================
  // Signatories
  // =========================================================================

  if (elements.show_signature && signatories.length > 0) {
    const sigY = H - 42;
    const sigSpacing = 70;
    const startX = W / 2 - ((signatories.length - 1) * sigSpacing) / 2;

    signatories.forEach((sig, i) => {
      const sx = startX + i * sigSpacing;

      // Signature image (if provided)
      const imgData = sigImages[i];
      if (imgData) {
        try {
          doc.addImage(imgData, "PNG", sx - 15, sigY - 18, 30, 14);
        } catch {
          // Skip if image is invalid
        }
      }

      doc.setDrawColor(150, 150, 150);
      doc.setLineWidth(0.3);
      doc.line(sx - 25, sigY, sx + 25, sigY);

      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      doc.setFont("helvetica", "bold");
      doc.text(sig.name, sx, sigY + 5, { align: "center" });

      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.setFont("helvetica", "normal");
      doc.text(sig.title, sx, sigY + 10, { align: "center" });
    });
  }

  // =========================================================================
  // Verification text
  // =========================================================================

  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.setFont("helvetica", "normal");
  doc.text(
    `${t("verifyAt")} omnilearn.space/certificates/verify/${data.verifyCode}`,
    W / 2,
    H - 17,
    { align: "center" },
  );
  doc.text(`${t("code")}: ${data.verifyCode}`, W / 2, H - 13, { align: "center" });

  // =========================================================================
  // Afflatus footer — centered row at bottom
  // =========================================================================

  const footerText = t("afflatus");
  doc.setFontSize(6.5);
  doc.setTextColor(130, 130, 130);
  doc.setFont("helvetica", "normal");

  const afflatusLogoW = 5;
  const afflatusLogoH = 5;
  const footerTextWidth = doc.getTextWidth(footerText);
  const footerTotalW = footerTextWidth + afflatusLogoW + 2;
  const footerStartX = W / 2 - footerTotalW / 2;
  const footerY = H - 7;

  if (afflatusLogoData) {
    try {
      doc.addImage(
        afflatusLogoData,
        "PNG",
        footerStartX,
        footerY - afflatusLogoH + 1.5,
        afflatusLogoW,
        afflatusLogoH,
      );
    } catch {
      // Skip if image fails
    }
  }

  doc.text(footerText, footerStartX + afflatusLogoW + 2, footerY, { align: "left" });

  return doc;
}

export async function downloadCertificatePdf(data: CertificateData) {
  const doc = await generateCertificatePdf(data);
  const filename = `certificate-${data.domainName.toLowerCase().replace(/\s+/g, "-")}-${data.userName.toLowerCase().replace(/\s+/g, "-")}.pdf`;
  doc.save(filename);
}
