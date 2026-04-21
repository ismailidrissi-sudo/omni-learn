"use client";

import Link from "next/link";
import { learnerContentHref } from "@/lib/learner-content-href";
import { apiAbsoluteMediaUrl } from "@/lib/api";

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
  enrolled?: boolean;
  progressPct?: number;
  onEnroll?: () => void;
  thumbnailUrl?: string | null;
}

export function ContentCard({
  id,
  title,
  type,
  description,
  durationMinutes,
  href,
  enrolled,
  progressPct,
  onEnroll,
  thumbnailUrl,
}: ContentCardProps) {
  const meta = TYPE_META[type] ?? { icon: "📎", label: type, color: "#C4A574" };
  const isCourse = type === "COURSE";
  const resolvedThumb = thumbnailUrl ? (apiAbsoluteMediaUrl(thumbnailUrl) ?? thumbnailUrl) : "";
  const link =
    href ?? (isCourse && enrolled ? `/course/${id}` : learnerContentHref(type, id));

  return (
    <Link
      href={link}
      className="group flex flex-col min-w-[220px] max-w-[260px] rounded-xl border border-[var(--color-bg-secondary)] bg-[var(--color-bg-primary)] hover:shadow-lg hover:border-brand-green/40 transition-all duration-200 overflow-hidden"
    >
      <div
        className="h-28 flex items-center justify-center text-4xl relative overflow-hidden"
        style={!resolvedThumb ? { background: `linear-gradient(135deg, ${meta.color}18, ${meta.color}08)` } : undefined}
      >
        {resolvedThumb ? (
          <img src={resolvedThumb} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="group-hover:scale-110 transition-transform duration-200">
            {meta.icon}
          </span>
        )}
        {isCourse && !enrolled && onEnroll && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEnroll(); }}
            className="absolute top-2 right-2 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-brand-green text-white shadow-md hover:bg-brand-green/90 transition-colors"
          >
            Enroll
          </button>
        )}
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

        {isCourse && enrolled && progressPct != null && (
          <div className="mt-2">
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

        {isCourse && (
          <div className="mt-2">
            {enrolled ? (
              <span className="text-xs font-semibold text-brand-green">
                Continue Learning →
              </span>
            ) : !onEnroll ? (
              <span className="text-xs font-semibold text-brand-green">
                View Course →
              </span>
            ) : null}
          </div>
        )}
      </div>
    </Link>
  );
}
