"use client";

import * as React from "react";

export type BannerVariant = "error" | "success" | "warning" | "info";

interface ErrorBannerProps {
  message: string;
  variant?: BannerVariant;
  onDismiss?: () => void;
  className?: string;
}

const variantConfig: Record<BannerVariant, { icon: string; cls: string }> = {
  error: {
    icon: "\u2715",
    cls: "border-[var(--color-error-border)] bg-[var(--color-error-light)] text-[var(--color-error)]",
  },
  success: {
    icon: "\u2713",
    cls: "border-[var(--color-success-border)] bg-[var(--color-success-light)] text-[var(--color-success)]",
  },
  warning: {
    icon: "\u26A0",
    cls: "border-[var(--color-warning-border)] bg-[var(--color-warning-light)] text-[var(--color-warning)]",
  },
  info: {
    icon: "\u2139",
    cls: "border-[var(--color-info-border)] bg-[var(--color-info-light)] text-[var(--color-info)]",
  },
};

export function ErrorBanner({ message, variant = "error", onDismiss, className = "" }: ErrorBannerProps) {
  if (!message) return null;
  const cfg = variantConfig[variant];

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed animate-[slideDown_0.2s_ease-out] ${cfg.cls} ${className}`}
    >
      <span className="flex-shrink-0 mt-0.5 text-base font-bold" aria-hidden>
        {cfg.icon}
      </span>
      <span className="flex-1 font-medium">{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="flex-shrink-0 p-0.5 rounded hover:opacity-70 transition-opacity opacity-60"
          aria-label="Dismiss"
        >
          &times;
        </button>
      )}
    </div>
  );
}
