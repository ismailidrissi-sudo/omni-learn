"use client";

import { useI18n } from "@/lib/i18n/context";

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

export function DocumentViewer({
  fileUrl,
  fileType,
  title,
  className = "",
}: DocumentViewerProps) {
  const { t } = useI18n();
  const ext = fileType || fileUrl.split(/[#?]/)[0].split(".").pop()?.toLowerCase() || "";
  const isPdf = PDF_EXT.test(fileUrl) || ext === "pdf";
  const isDoc = DOC_EXT.test(fileUrl) || ["doc", "docx"].includes(ext);

  // Google Docs Viewer for DOC/DOCX (works for most public URLs)
  const viewerUrl = isDoc
    ? `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`
    : fileUrl;

  return (
    <div className={`rounded-lg border border-brand-grey-light overflow-hidden bg-white ${className}`}>
      {title && (
        <div className="px-4 py-2 border-b border-brand-grey-light bg-brand-grey-light/30">
          <h3 className="text-brand-grey-dark font-medium">{title}</h3>
        </div>
      )}
      <div className="relative w-full min-h-[500px]" style={{ height: "70vh" }}>
        <iframe
          src={viewerUrl}
          title={title || t("document.viewer")}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-popups"
        />
      </div>
      <div className="px-4 py-2 border-t border-brand-grey-light flex justify-between items-center text-sm text-brand-grey">
        <span>{isPdf ? "PDF" : isDoc ? "Document" : ext.toUpperCase()}</span>
        <a
          href={fileUrl}
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
