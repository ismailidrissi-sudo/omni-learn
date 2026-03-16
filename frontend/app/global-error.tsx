"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "'Futura', 'Futura PT', 'Jost', 'Century Gothic', system-ui, sans-serif",
          backgroundColor: "#F5F5DC",
          color: "#1a1212",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
          }}
        >
          <div style={{ maxWidth: "32rem", width: "100%", textAlign: "center" }}>
            <div
              style={{
                width: "5rem",
                height: "5rem",
                margin: "0 auto 2rem",
                borderRadius: "1rem",
                backgroundColor: "#fef2f2",
                border: "1px solid #fecaca",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#dc2626"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            <h2 style={{ fontSize: "1.875rem", fontWeight: 700, marginBottom: "0.75rem", letterSpacing: "-0.02em" }}>
              Something went wrong
            </h2>
            <p style={{ color: "#6b7280", marginBottom: "2.5rem", lineHeight: 1.6, maxWidth: "24rem", margin: "0 auto 2.5rem" }}>
              A critical error occurred. Don&apos;t worry — try refreshing the page.
            </p>

            <button
              onClick={reset}
              style={{
                borderRadius: "0.75rem",
                backgroundColor: "#059669",
                padding: "0.875rem 2rem",
                fontSize: "0.9375rem",
                fontWeight: 600,
                color: "#fff",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "background-color 0.15s ease",
              }}
              onMouseOver={(e) => ((e.target as HTMLButtonElement).style.backgroundColor = "#10b981")}
              onMouseOut={(e) => ((e.target as HTMLButtonElement).style.backgroundColor = "#059669")}
            >
              Try again
            </button>

            {error.digest && (
              <p style={{ marginTop: "2rem", fontSize: "0.75rem", color: "#9ca3af" }}>
                Error ID: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
