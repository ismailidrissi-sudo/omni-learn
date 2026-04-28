import { apiAbsoluteMediaUrl } from "@/lib/api";

export type ColumnDef<T> = {
  key: string;
  header: string;
  accessor: (row: T) => string | number | null | undefined;
};

function csvEscape(cell: string): string {
  const s = String(cell ?? "");
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildExportFilename(slug: string, base: string, ext: string): string {
  const day = new Date().toISOString().split("T")[0];
  const safeSlug = slug.replace(/[^a-zA-Z0-9_-]/g, "") || "academy";
  const safeBase = base.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase() || "export";
  return `omnilearn-${safeSlug}-${safeBase}-${day}.${ext}`;
}

export function exportToCsv<T>(opts: {
  rows: T[];
  columns: ColumnDef<T>[];
  filename: string;
}): void {
  const { rows, columns, filename } = opts;
  const header = columns.map((c) => csvEscape(c.header)).join(",");
  const lines = rows.map((row) =>
    columns.map((c) => csvEscape(String(c.accessor(row) ?? ""))).join(","),
  );
  const bom = "\uFEFF";
  const blob = new Blob([bom + header + "\r\n" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Fetch remote image and convert to data URL (for PDF embedding). */
export async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors", credentials: "include" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function formatFromDataUrl(dataUrl: string): "PNG" | "JPEG" | "WEBP" {
  if (dataUrl.includes("image/jpeg")) return "JPEG";
  if (dataUrl.includes("image/webp")) return "WEBP";
  return "PNG";
}

function hexToRgbTuple(hex: string): [number, number, number] {
  const h = hex.replace("#", "").trim();
  if (h.length !== 6 && h.length !== 3) return [5, 150, 105];
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return [5, 150, 105];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function resolveBrandRgb(): [number, number, number] {
  if (typeof window === "undefined") return [5, 150, 105];
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--color-brand").trim();
  if (raw.startsWith("#")) return hexToRgbTuple(raw);
  return [5, 150, 105];
}

function pageDims(doc: import("jspdf").jsPDF): { width: number; height: number } {
  const ps = doc.internal.pageSize;
  const w =
    typeof (ps as { getWidth?: () => number }).getWidth === "function"
      ? (ps as { getWidth: () => number }).getWidth()
      : (ps as { width: number }).width;
  const h =
    typeof (ps as { getHeight?: () => number }).getHeight === "function"
      ? (ps as { getHeight: () => number }).getHeight()
      : (ps as { height: number }).height;
  return { width: w, height: h };
}

export async function exportToPdf<T>(opts: {
  rows: T[];
  columns: ColumnDef<T>[];
  filename: string;
  title: string;
  subtitle?: string;
  academyLogoUrl?: string | null;
}): Promise<void> {
  const { rows, columns, filename, title, subtitle, academyLogoUrl } = opts;

  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const { width: pageWidth, height: pageHeight } = pageDims(doc);
  const margin = 36;

  const rawAcademy =
    academyLogoUrl && academyLogoUrl.trim().length > 0
      ? (apiAbsoluteMediaUrl(academyLogoUrl) ?? academyLogoUrl)
      : null;
  const academyDataUrl = rawAcademy ? await loadImageAsDataUrl(rawAcademy) : null;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const omniDataUrl = await loadImageAsDataUrl(`${origin}/omni-learn-logo.png`);

  const headerTop = margin;
  if (academyDataUrl) {
    try {
      doc.addImage(
        academyDataUrl,
        formatFromDataUrl(academyDataUrl),
        margin,
        headerTop,
        90,
        38,
      );
    } catch {
      /* ignore */
    }
  }
  if (omniDataUrl) {
    try {
      const w = 100;
      const h = 28;
      doc.addImage(omniDataUrl, formatFromDataUrl(omniDataUrl), pageWidth - margin - w, headerTop, w, h);
    } catch {
      /* ignore */
    }
  }

  let headerBottom = headerTop + 44;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text(title, pageWidth / 2, headerBottom, { align: "center" });
  headerBottom += 18;
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text(subtitle, pageWidth / 2, headerBottom, { align: "center" });
    headerBottom += 14;
  }

  const brand = resolveBrandRgb();
  const head = [columns.map((c) => c.header)];
  const body = rows.map((row) => columns.map((c) => String(c.accessor(row) ?? "")));

  autoTable(doc, {
    head,
    body,
    startY: headerBottom + 8,
    margin: { left: margin, right: margin, bottom: 36 },
    styles: { fontSize: 9, cellPadding: 4, overflow: "linebreak" },
    headStyles: {
      fillColor: brand,
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didDrawPage: (data) => {
      const d = data.doc;
      const { width: pw, height: ph } = pageDims(d);
      d.setFontSize(8);
      d.setTextColor(100, 100, 100);
      d.text("Powered by Omnilearn", margin, ph - 14);
      d.text(`Page ${data.pageNumber}`, pw - margin, ph - 14, { align: "right" });
    },
  });

  doc.save(filename);
}
