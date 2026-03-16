"use client";

import { useEffect, useState } from "react";
import { useToastStore, type ToastType } from "@/lib/use-toast";

const icons: Record<ToastType, string> = {
  success: "\u2713",
  error: "\u2715",
  warning: "\u26A0",
  info: "\u2139",
};

const styles: Record<ToastType, { bg: string; border: string; text: string; icon: string }> = {
  error: {
    bg: "bg-[var(--color-error-light)]",
    border: "border-[var(--color-error-border)]",
    text: "text-[var(--color-error)]",
    icon: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
  },
  success: {
    bg: "bg-[var(--color-success-light)]",
    border: "border-[var(--color-success-border)]",
    text: "text-[var(--color-success)]",
    icon: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400",
  },
  warning: {
    bg: "bg-[var(--color-warning-light)]",
    border: "border-[var(--color-warning-border)]",
    text: "text-[var(--color-warning)]",
    icon: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
  },
  info: {
    bg: "bg-[var(--color-info-light)]",
    border: "border-[var(--color-info-border)]",
    text: "text-[var(--color-info)]",
    icon: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
  },
};

function ToastItem({ id, type, message }: { id: string; type: ToastType; message: string }) {
  const remove = useToastStore((s) => s.removeToast);
  const [leaving, setLeaving] = useState(false);

  const dismiss = () => {
    setLeaving(true);
    setTimeout(() => remove(id), 200);
  };

  const s = styles[type];

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`flex items-start gap-3 w-full max-w-sm px-4 py-3.5 rounded-xl border shadow-lg backdrop-blur-sm
        ${s.bg} ${s.border} ${s.text}
        ${leaving ? "animate-[slideOut_0.2s_ease-in_forwards]" : "animate-[slideIn_0.25s_ease-out]"}
      `}
    >
      <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${s.icon}`}>
        {icons[type]}
      </span>
      <p className="flex-1 text-sm font-medium leading-snug pt-0.5">{message}</p>
      <button
        onClick={dismiss}
        className="flex-shrink-0 p-0.5 rounded hover:opacity-70 transition-opacity text-current opacity-60"
        aria-label="Dismiss"
      >
        <span className="text-base leading-none">&times;</span>
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem {...t} />
        </div>
      ))}
    </div>
  );
}
