"use client";

import { LanguageToggle } from "./language-toggle";
import { ThemeToggle } from "./theme-toggle";

/**
 * Fixed top-right toolbar: language + theme toggles.
 * Glass-morphism style that integrates with both light and dark themes.
 */
export function GlobalToolbar() {
  return (
    <div
      className="fixed top-4 right-4 z-[9999] flex items-center gap-1 rounded-xl border border-gray-200/80 bg-white/80 px-1.5 py-1 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-white/5"
      role="toolbar"
      aria-label="Language and theme options"
    >
      <LanguageToggle />
      <div className="h-6 w-px bg-gray-300/80 dark:bg-white/20" aria-hidden />
      <ThemeToggle />
    </div>
  );
}
