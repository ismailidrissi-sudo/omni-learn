"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

type ThemeToggleProps = {
  variant?: "default" | "inline";
};

export function ThemeToggle({ variant = "default" }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg animate-pulse bg-gray-200/50 dark:bg-white/5 ${variant === "inline" ? "w-8 h-8" : "w-10 h-10"}`}
        aria-hidden
      />
    );
  }

  const isDark = resolvedTheme === "dark";
  const isInline = variant === "inline";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`flex items-center justify-center rounded-lg hover:bg-gray-100/80 dark:hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#059669]/50 focus:ring-offset-2 dark:focus:ring-offset-[#0f1510] transition-colors ${isInline ? "w-8 h-8 min-w-[32px] min-h-[32px] text-base" : "w-10 h-10 min-w-[40px] min-h-[40px] text-xl"}`}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <span className="text-amber-400" aria-hidden>☀️</span>
      ) : (
        <span className="text-[#10b981]" aria-hidden>🌙</span>
      )}
    </button>
  );
}
