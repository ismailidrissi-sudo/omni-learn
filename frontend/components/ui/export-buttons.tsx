"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  buildExportFilename,
  exportToCsv,
  exportToPdf,
  type ColumnDef,
} from "@/lib/exports/list-export";
import { toast } from "@/lib/use-toast";
import { useI18n } from "@/lib/i18n/context";

export type ExportButtonsProps<T> = {
  rows: T[];
  columns: ColumnDef<T>[];
  tenantSlug: string;
  filenameBase: string;
  pdfTitle: string;
  pdfSubtitle?: string;
  academyLogoUrl?: string | null;
};

export function ExportButtons<T>({
  rows,
  columns,
  tenantSlug,
  filenameBase,
  pdfTitle,
  pdfSubtitle,
  academyLogoUrl,
}: ExportButtonsProps<T>) {
  const { t } = useI18n();
  const [pdfBusy, setPdfBusy] = useState(false);

  const runCsv = () => {
    if (rows.length === 0) {
      toast(t("adminTenant.exportEmpty"), "warning");
      return;
    }
    exportToCsv({
      rows,
      columns,
      filename: buildExportFilename(tenantSlug, filenameBase, "csv"),
    });
    toast(t("adminTenant.exportCsvSuccess"), "success");
  };

  const runPdf = async () => {
    if (rows.length === 0) {
      toast(t("adminTenant.exportEmpty"), "warning");
      return;
    }
    setPdfBusy(true);
    try {
      await exportToPdf({
        rows,
        columns,
        filename: buildExportFilename(tenantSlug, filenameBase, "pdf"),
        title: pdfTitle,
        subtitle:
          pdfSubtitle ??
          t("adminTenant.exportPdfSubtitle", {
            count: String(rows.length),
            date: new Date().toLocaleString(),
          }),
        academyLogoUrl,
      });
      toast(t("adminTenant.exportPdfSuccess"), "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : t("adminTenant.exportPdfFailed"), "error");
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <Button type="button" variant="outline" size="sm" onClick={runCsv}>
        {t("adminTenant.exportCsv")}
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => void runPdf()} disabled={pdfBusy}>
        {pdfBusy ? t("common.loading") : t("adminTenant.exportPdf")}
      </Button>
    </div>
  );
}
