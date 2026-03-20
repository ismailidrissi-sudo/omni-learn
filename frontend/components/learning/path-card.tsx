"use client";

import { useState } from "react";
import Link from "next/link";

interface PathCardProps {
  id: string;
  name: string;
  description?: string | null;
  domain?: { name: string; slug?: string } | string | null;
  stepCount?: number;
  difficulty?: string | null;
  enrolled?: boolean;
  progressPct?: number;
  href?: string;
  onEnroll?: () => void | Promise<void>;
}

export function PathCard({
  id,
  name,
  description,
  domain,
  stepCount,
  difficulty,
  enrolled,
  progressPct,
  href,
  onEnroll,
}: PathCardProps) {
  const [enrolling, setEnrolling] = useState(false);
  const domainName = typeof domain === "object" ? domain?.name : domain;
  const link = href ?? `/learn?path=${id}`;

  const handleEnroll = async () => {
    if (!onEnroll || enrolling) return;
    setEnrolling(true);
    try {
      await onEnroll();
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <div className="group flex flex-col min-w-[260px] max-w-[300px] rounded-xl border border-[var(--color-bg-secondary)] bg-[var(--color-bg-primary)] hover:shadow-lg hover:border-brand-green/40 transition-all duration-200 overflow-hidden">
      <div className="h-28 flex items-center justify-center bg-gradient-to-br from-brand-green/15 to-brand-green/5">
        <span className="text-4xl group-hover:scale-110 transition-transform duration-200">
          🛤️
        </span>
      </div>
      <div className="p-4 flex flex-col flex-1">
        {domainName && (
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-green mb-1.5">
            {domainName}
          </span>
        )}
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] leading-snug line-clamp-2 mb-1.5">
          {name}
        </h3>
        {description && (
          <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2 mb-2">
            {description}
          </p>
        )}
        <div className="mt-auto flex items-center gap-3 text-[11px] text-[var(--color-text-secondary)]">
          {stepCount != null && <span>{stepCount} steps</span>}
          {difficulty && <span className="capitalize">{difficulty}</span>}
        </div>

        {enrolled && progressPct != null && (
          <div className="mt-3">
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-[var(--color-text-secondary)]">Progress</span>
              <span className="font-semibold text-brand-green">{progressPct}%</span>
            </div>
            <div className="h-1.5 bg-brand-green/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-green rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        <div className="mt-3">
          {enrolled ? (
            <Link
              href={link}
              className="inline-flex items-center text-xs font-semibold text-brand-green hover:underline"
            >
              Continue Learning →
            </Link>
          ) : onEnroll ? (
            <button
              onClick={handleEnroll}
              disabled={enrolling}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-brand-green text-white shadow-md hover:bg-brand-green/90 transition-colors disabled:opacity-50"
            >
              {enrolling ? "Enrolling…" : "Enroll"}
            </button>
          ) : (
            <Link
              href={link}
              className="inline-flex items-center text-xs font-semibold text-brand-green hover:underline"
            >
              View Path →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
