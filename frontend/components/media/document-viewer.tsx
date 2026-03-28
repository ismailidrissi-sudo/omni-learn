"use client";

import { useI18n } from "@/lib/i18n/context";
import { apiAbsoluteMediaUrl } from "@/lib/api";

/**
 * Document Viewer — PDF, DOC, DOCX
 * omnilearn.space | Supports all document content fed to the app
 */

interface DocumentViewerProps {
  fileUrl: string;
  fileType?: string;
  title?: string;
  className?: string;
}

const PDF_EXT = /\.pdf$/i;
const DOC_EXT = /\.(doc|docx)$/i;

function resolveUrl(raw: string): string {
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return apiAbsoluteMediaUrl(raw) || raw;
}

export function DocumentViewer({
  fileUrl,
  fileType,
  title,
  className = "",
}: DocumentViewerProps) {
  const { t } = useI18n();
  const resolved = resolveUrl(fileUrl);
  const ext = fileType || resolved.split(/[#?]/)[0].split(".").pop()?.toLowerCase() || "";
  const isPdf = PDF_EXT.test(resolved) || ext === "pdf";
  const isDoc = DOC_EXT.test(resolved) || ["doc", "docx"].includes(ext);

  const viewerUrl = isDoc
    ? `https://docs.google.com/viewer?url=${encodeURIComponent(resolved)}&embedded=true`
    : resolved;

  return (
    <div className={`rounded-lg border border-brand-grey-light overflow-hidden bg-white ${className}`}>
      {title && (
        <div className="px-4 py-2 border-b border-brand-grey-light bg-brand-grey-light/30">
          <h3 className="text-brand-grey-dark font-medium">{title}</h3>
        </div>
      )}
      <div className="relative w-full min-h-[500px]" style={{ height: "70vh" }}>
        {isPdf ? (
          <object
            data={viewerUrl}
            type="application/pdf"
            className="w-full h-full"
          >
            <p className="p-6 text-center text-brand-grey">
              Unable to display PDF.{" "}
              <a href={resolved} target="_blank" rel="noopener noreferrer" className="text-brand-purple hover:underline">
                Download it here
              </a>.
            </p>
          </object>
        ) : (
          <iframe
            src={viewerUrl}
            title={title || t("document.viewer")}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        )}
      </div>
      <div className="px-4 py-2 border-t border-brand-grey-light flex justify-between items-center text-sm text-brand-grey">
        <span>{isPdf ? "PDF" : isDoc ? "Document" : ext.toUpperCase()}</span>
        <a
          href={resolved}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-purple hover:underline"
        >
          {t("document.openInNewTab")}
        </a>
      </div>
    </div>
  );
}
