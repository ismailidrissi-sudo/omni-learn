"use client";

import { Download } from "lucide-react";
import { useAnalyticsFilters } from "@/components/analytics/analytics-filters-context";
import { downloadBinaryExport, downloadCsv } from "@/lib/csv-download";

const BTN =
  "flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-[var(--color-bg-secondary)] text-sm font-medium text-[var(--color-text-primary)] hover:border-brand-purple/50 hover:bg-brand-purple/5 transition-colors";

export default function AnalyticsExportPage() {
  const { filtersRecord } = useAnalyticsFilters();

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--color-text-muted)]">
        Download CSV reports using the current date range and filters from the bar above.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <button type="button" className={BTN} onClick={() => downloadCsv("/analytics/deep/export/users", filtersRecord, "users")}>
          <Download size={18} /> Users
        </button>
        <button type="button" className={BTN} onClick={() => downloadCsv("/analytics/deep/export/content", filtersRecord, "content")}>
          <Download size={18} /> Content
        </button>
        <button type="button" className={BTN} onClick={() => downloadCsv("/analytics/deep/export/sessions", filtersRecord, "sessions")}>
          <Download size={18} /> Sessions
        </button>
        <button type="button" className={BTN} onClick={() => downloadCsv("/analytics/deep/export/geo", filtersRecord, "geography")}>
          <Download size={18} /> Geography (CSV)
        </button>
        <button
          type="button"
          className={BTN}
          onClick={() =>
            downloadBinaryExport("/analytics/deep/export/geo.xlsx", filtersRecord, "omnilearn-geo.xlsx")
          }
        >
          <Download size={18} /> Geography (Excel)
        </button>
        <button
          type="button"
          className={BTN}
          onClick={() =>
            downloadBinaryExport("/analytics/deep/export/geo.pdf", filtersRecord, "omnilearn-geo.pdf")
          }
        >
          <Download size={18} /> Geography (PDF)
        </button>
        <button type="button" className={BTN} onClick={() => downloadCsv("/analytics/deep/export/demographics", filtersRecord, "demographics")}>
          <Download size={18} /> Demographics
        </button>
        <button type="button" className={BTN} onClick={() => downloadCsv("/analytics/deep/export/full", filtersRecord, "full-export")}>
          <Download size={18} /> Full export
        </button>
      </div>
    </div>
  );
}
