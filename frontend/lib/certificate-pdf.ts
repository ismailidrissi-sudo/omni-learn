import jsPDF from "jspdf";

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
}

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
    try { return JSON.parse(val); } catch { return fallback; }
  }
  return (val as T) ?? fallback;
}

/**
 * Generate a professional completion certificate PDF.
 * Uses jsPDF with landscape A4 layout, styled per domain template.
 */
export function generateCertificatePdf(data: CertificateData): jsPDF {
  const theme = parseJson(data.themeConfig, DEFAULT_THEME);
  const elements = parseJson(data.elementsConfig, DEFAULT_ELEMENTS);
  const signatories = parseJson<Signatory[]>(data.signatories, []);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297;
  const H = 210;

  const primary = hexToRgb(theme.primary_color);
  const secondary = hexToRgb(theme.secondary_color);
  const accent = hexToRgb(theme.accent_color);

  // --- Background ---
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, W, H, "F");

  // Top gradient band
  const gradientSteps = 60;
  for (let i = 0; i < gradientSteps; i++) {
    const t = i / gradientSteps;
    const r = Math.round(primary[0] + (secondary[0] - primary[0]) * t);
    const g = Math.round(primary[1] + (secondary[1] - primary[1]) * t);
    const b = Math.round(primary[2] + (secondary[2] - primary[2]) * t);
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
    [18, 18], [W - 18, 18], [18, H - 18], [W - 18, H - 18],
  ];
  doc.setFillColor(...accent);
  for (const [cx, cy] of corners) {
    doc.circle(cx, cy, 1.5, "F");
  }

  let y = 30;

  // --- Header / Organization ---
  if (elements.show_logo && data.tenantName) {
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.setFont("helvetica", "normal");
    doc.text(data.tenantName.toUpperCase(), W / 2, y, { align: "center" });
    y += 8;
  }

  // --- Title ---
  doc.setFontSize(28);
  doc.setTextColor(...primary);
  doc.setFont("helvetica", "bold");
  doc.text("CERTIFICATE OF COMPLETION", W / 2, y, { align: "center" });
  y += 6;

  // Decorative line under title
  const lineW = 80;
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.5);
  doc.line(W / 2 - lineW / 2, y, W / 2 + lineW / 2, y);
  y += 12;

  // --- "This certifies that" ---
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");
  doc.text("This is to certify that", W / 2, y, { align: "center" });
  y += 12;

  // --- Recipient Name ---
  doc.setFontSize(26);
  doc.setTextColor(40, 40, 40);
  doc.setFont("helvetica", "bold");
  doc.text(data.userName, W / 2, y, { align: "center" });
  y += 5;

  // Name underline
  const nameWidth = doc.getTextWidth(data.userName);
  doc.setDrawColor(...primary);
  doc.setLineWidth(0.4);
  doc.line(W / 2 - nameWidth / 2 - 5, y, W / 2 + nameWidth / 2 + 5, y);
  y += 10;

  // --- "has successfully completed" ---
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");
  doc.text("has successfully completed the learning path", W / 2, y, { align: "center" });
  y += 10;

  // --- Path Name ---
  doc.setFontSize(18);
  doc.setTextColor(...primary);
  doc.setFont("helvetica", "bold");
  doc.text(data.pathName, W / 2, y, { align: "center" });
  y += 7;

  // --- Domain ---
  doc.setFontSize(12);
  doc.setTextColor(80, 80, 80);
  doc.setFont("helvetica", "normal");
  doc.text(`Domain: ${data.domainName}`, W / 2, y, { align: "center" });
  y += 8;

  // --- Grade ---
  if (elements.show_grade && data.grade) {
    doc.setFontSize(13);
    doc.setTextColor(...accent);
    doc.setFont("helvetica", "bold");
    doc.text(`Grade: ${data.grade}`, W / 2, y, { align: "center" });
    y += 7;
  }

  // --- Learning hours ---
  if (elements.show_hours && data.totalLearningMinutes && data.totalLearningMinutes > 0) {
    const hours = Math.round(data.totalLearningMinutes / 60 * 10) / 10;
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "normal");
    doc.text(`Total learning time: ${hours} hours`, W / 2, y, { align: "center" });
    y += 7;
  }

  // --- Date ---
  const dateStr = new Date(data.issuedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");
  doc.text(`Issued on ${dateStr}`, W / 2, y, { align: "center" });
  y += 5;

  // --- Seal ---
  if (elements.show_seal) {
    const sealY = H - 55;
    const sealX = W - 55;
    doc.setDrawColor(...accent);
    doc.setLineWidth(1.2);
    doc.circle(sealX, sealY, 16);
    doc.setLineWidth(0.4);
    doc.circle(sealX, sealY, 13);

    doc.setFontSize(6);
    doc.setTextColor(...accent);
    doc.setFont("helvetica", "bold");
    const sealLines = theme.seal_text.split(" ");
    const mid = Math.ceil(sealLines.length / 2);
    doc.text(sealLines.slice(0, mid).join(" "), sealX, sealY - 2, { align: "center" });
    doc.text(sealLines.slice(mid).join(" "), sealX, sealY + 3, { align: "center" });
  }

  // --- Signatories ---
  if (elements.show_signature && signatories.length > 0) {
    const sigY = H - 42;
    const sigSpacing = 70;
    const startX = W / 2 - ((signatories.length - 1) * sigSpacing) / 2;

    signatories.forEach((sig, i) => {
      const sx = startX + i * sigSpacing;
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

  // --- Verification code ---
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.setFont("helvetica", "normal");
  doc.text(`Verify at omnilearn.space/certificates/verify/${data.verifyCode}`, W / 2, H - 17, { align: "center" });
  doc.text(`Code: ${data.verifyCode}`, W / 2, H - 13, { align: "center" });

  return doc;
}

export function downloadCertificatePdf(data: CertificateData) {
  const doc = generateCertificatePdf(data);
  const filename = `certificate-${data.domainName.toLowerCase().replace(/\s+/g, "-")}-${data.userName.toLowerCase().replace(/\s+/g, "-")}.pdf`;
  doc.save(filename);
}
