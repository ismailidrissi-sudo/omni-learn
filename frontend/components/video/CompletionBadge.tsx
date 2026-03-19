'use client';

interface CompletionBadgeProps {
  visible: boolean;
}

export function CompletionBadge({ visible }: CompletionBadgeProps) {
  return (
    <div
      className={`absolute top-3 right-3 z-10 flex items-center gap-1.5 
        bg-green-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full
        transition-all duration-300 ${
          visible
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 -translate-y-2 pointer-events-none'
        }`}
    >
      <svg
        className="w-3.5 h-3.5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.5}
          d="M5 13l4 4L19 7"
        />
      </svg>
      Completed
    </div>
  );
}
