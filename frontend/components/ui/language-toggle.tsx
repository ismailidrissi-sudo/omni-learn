"use client";

import { useState, useRef, useEffect } from "react";
import { useI18n } from "@/lib/i18n/context";
import type { Locale } from "@/lib/i18n/context";

const LOCALES: { code: Locale; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
];

type LanguageToggleProps = {
  variant?: "default" | "inline";
};

export function LanguageToggle({ variant = "default" }: LanguageToggleProps) {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];
  const isInline = variant === "inline";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 rounded-lg text-sm font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-100/80 dark:hover:bg-white/10 transition-colors ${isInline ? "px-2 py-1.5 min-h-[32px]" : "px-3 py-2 min-h-[40px]"}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Select language"
      >
        <span className="text-base leading-none">{current.flag}</span>
        {!isInline && <span className="min-w-[4rem] text-left">{current.label}</span>}
        <span className="text-gray-500 dark:text-gray-400 text-xs" aria-hidden>▾</span>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute top-full right-0 mt-1 min-w-[140px] py-1 rounded-lg border border-gray-200 bg-white shadow-xl z-50 dark:border-white/10 dark:bg-gray-900/95 dark:shadow-2xl backdrop-blur-xl"
        >
          {LOCALES.map((l) => (
            <li key={l.code} role="option" aria-selected={locale === l.code}>
              <button
                type="button"
                onClick={() => {
                  setLocale(l.code);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-4 py-2 text-left text-sm transition-colors ${
                  locale === l.code
                    ? "bg-brand-purple/20 text-brand-purple dark:text-brand-purple-light font-medium"
                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10"
                }`}
              >
                <span className="text-lg">{l.flag}</span>
                {l.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
