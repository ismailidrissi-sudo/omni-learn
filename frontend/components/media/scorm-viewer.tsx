"use client";

/**
 * SCORM Viewer — Renders SCORM package in iframe
 * omnilearn.space | Phase 2 | Course builder
 */

interface ScormViewerProps {
  scormPackageUrl: string;
  xapiEndpoint?: string;
  className?: string;
  onComplete?: () => void;
}

export function ScormViewer({
  scormPackageUrl,
  xapiEndpoint,
  className = "",
  onComplete,
}: ScormViewerProps) {
  // SCORM packages typically have an index.html or launch file
  const launchUrl = scormPackageUrl.endsWith("/")
    ? `${scormPackageUrl}index.html`
    : scormPackageUrl.includes(".html")
    ? scormPackageUrl
    : `${scormPackageUrl}/index.html`;

  return (
    <div className={`rounded-lg border border-brand-grey-light overflow-hidden bg-white ${className}`}>
      <iframe
        src={launchUrl}
        title="SCORM Content"
        className="w-full aspect-video min-h-[500px] border-0"
        sandbox="allow-scripts allow-same-origin allow-forms"
      />
      {xapiEndpoint && (
        <p className="text-xs text-brand-grey p-2">
          xAPI endpoint: {xapiEndpoint}
        </p>
      )}
    </div>
  );
}
