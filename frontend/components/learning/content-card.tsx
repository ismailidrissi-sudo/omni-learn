"use client";

import Link from "next/link";

const TYPE_META: Record<string, { icon: string; label: string; color: string }> = {
  COURSE: { icon: "📚", label: "Course", color: "#059669" },
  MICRO_LEARNING: { icon: "⚡", label: "Micro-Learning", color: "#10b981" },
  PODCAST: { icon: "🎧", label: "Podcast", color: "#059669" },
  DOCUMENT: { icon: "📄", label: "Document", color: "#C4A574" },
  IMPLEMENTATION_GUIDE: { icon: "🛠️", label: "Guide", color: "#C4A574" },
  QUIZ_ASSESSMENT: { icon: "✅", label: "Quiz", color: "#059669" },
  GAME: { icon: "🎮", label: "Game", color: "#10b981" },
  VIDEO: { icon: "🎬", label: "Video", color: "#C4A574" },
};

interface ContentCardProps {
  id: string;
  title: string;
  type: string;
  description?: string | null;
  durationMinutes?: number | null;
  href?: string;
}

export function ContentCard({
  id,
  title,
  type,
  description,
  durationMinutes,
  href,
}: ContentCardProps) {
  const meta = TYPE_META[type] ?? { icon: "📎", label: type, color: "#C4A574" };
  const link = href ?? `/content/${id}`;

  return (
    <Link
      href={link}
      className="group flex flex-col min-w-[220px] max-w-[260px] rounded-xl border border-[var(--color-bg-secondary)] bg-[var(--color-bg-primary)] hover:shadow-lg hover:border-brand-green/40 transition-all duration-200 overflow-hidden"
    >
      <div
        className="h-28 flex items-center justify-center text-4xl"
        style={{ background: `linear-gradient(135deg, ${meta.color}18, ${meta.color}08)` }}
      >
        <span className="group-hover:scale-110 transition-transform duration-200">
          {meta.icon}
        </span>
      </div>
      <div className="p-4 flex flex-col flex-1">
        <span
          className="text-[11px] font-semibold uppercase tracking-wider mb-1.5"
          style={{ color: meta.color }}
        >
          {meta.label}
        </span>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] leading-snug line-clamp-2 mb-1.5">
          {title}
        </h3>
        {description && (
          <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2 mb-2">
            {description}
          </p>
        )}
        <div className="mt-auto flex items-center gap-2">
          {durationMinutes != null && durationMinutes > 0 && (
            <span className="text-[11px] text-[var(--color-text-secondary)]">
              {durationMinutes} min
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
