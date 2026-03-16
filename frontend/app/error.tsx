"use client";

import { useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="max-w-lg w-full text-center"
      >
        <div className="mx-auto mb-8 w-20 h-20 rounded-2xl bg-[var(--color-error-light)] border border-[var(--color-error-border)] flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-error)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h2 className="text-3xl font-bold text-[var(--color-text-primary)] mb-3 tracking-tight">
          Something went wrong
        </h2>
        <p className="text-[var(--color-text-muted)] text-base mb-10 max-w-sm mx-auto leading-relaxed">
          An unexpected error occurred. Don&apos;t worry, your data is safe. Try refreshing or head back home.
        </p>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-xl bg-[#059669] px-7 py-3 text-sm font-semibold text-white transition-all hover:bg-[#10b981] hover:shadow-lg hover:shadow-[#059669]/20 active:scale-[0.98]"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-xl border-2 border-[var(--color-bg-secondary)] px-7 py-3 text-sm font-semibold text-[var(--color-text-primary)] transition-all hover:border-[#059669] hover:text-[#059669]"
          >
            Go home
          </Link>
        </div>

        {error.digest && (
          <p className="mt-8 text-xs text-[var(--color-text-muted)] opacity-60">
            Error ID: {error.digest}
          </p>
        )}
      </motion.div>
    </div>
  );
}
