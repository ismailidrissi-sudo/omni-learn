"use client";

import { useRef } from "react";

interface ContentSectionProps {
  title: string;
  icon: string;
  count?: number;
  children: React.ReactNode;
  emptyMessage?: string;
  isEmpty?: boolean;
}

export function ContentSection({
  title,
  icon,
  count,
  children,
  emptyMessage,
  isEmpty,
}: ContentSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = 280;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  if (isEmpty) {
    return null;
  }

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">{title}</h2>
          {count != null && count > 0 && (
            <span className="text-xs font-medium text-[var(--color-text-secondary)] bg-[var(--color-bg-secondary)] px-2 py-0.5 rounded-full">
              {count}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => scroll("left")}
            className="w-8 h-8 rounded-full border border-[var(--color-bg-secondary)] flex items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
            aria-label="Scroll left"
          >
            ‹
          </button>
          <button
            onClick={() => scroll("right")}
            className="w-8 h-8 rounded-full border border-[var(--color-bg-secondary)] flex items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
            aria-label="Scroll right"
          >
            ›
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-brand-grey/30 scrollbar-track-transparent"
        style={{ scrollbarWidth: "thin" }}
      >
        {children}
      </div>
      {emptyMessage && isEmpty && (
        <p className="text-sm text-[var(--color-text-secondary)]">{emptyMessage}</p>
      )}
    </section>
  );
}
