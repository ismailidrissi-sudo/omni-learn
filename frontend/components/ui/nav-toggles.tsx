"use client";

import { LanguageToggle } from "./language-toggle";
import { ThemeToggle } from "./theme-toggle";

/** Inline language + theme toggles for integration in headers/nav bars */
export function NavToggles({ variant = "inline" }: { variant?: "default" | "inline" }) {
  return (
    <div className="flex items-center gap-1">
      <LanguageToggle variant={variant} />
      <div className="h-5 w-px bg-gray-300/80 dark:bg-white/20" aria-hidden />
      <ThemeToggle variant={variant} />
    </div>
  );
}
