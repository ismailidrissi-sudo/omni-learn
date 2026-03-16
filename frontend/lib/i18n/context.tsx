"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import en from "./translations/en.json";
import fr from "./translations/fr.json";
import ar from "./translations/ar.json";

export type Locale = "en" | "fr" | "ar";

const LOCALE_STORAGE_KEY = "omnilearn-locale";

const translations: Record<Locale, Record<string, unknown>> = {
  en: en as Record<string, unknown>,
  fr: fr as Record<string, unknown>,
  ar: ar as Record<string, unknown>,
};

function getNested(obj: Record<string, unknown>, path: string): string | undefined {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : undefined;
}

function interpolate(str: string, params: Record<string, string | number>): string {
  return str.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`));
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  isRtl: boolean;
  isLoading: boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function getInitialLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY) as Locale | null;
  return stored && (stored === "en" || stored === "fr" || stored === "ar") ? stored : "en";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [translationsMap, setTranslationsMap] = useState<Record<string, unknown>>(() => translations["en"]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setLocaleState(getInitialLocale());
  }, []);

  useEffect(() => {
    setTranslationsMap(translations[locale]);
  }, [locale]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
    document.documentElement.lang = newLocale;
    document.documentElement.dir = newLocale === "ar" ? "rtl" : "ltr";
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const value =
        getNested(translationsMap as Record<string, unknown>, key) ??
        getNested(translations.en as Record<string, unknown>, key) ??
        key;
      return params ? interpolate(value, params) : value;
    },
    [translationsMap]
  );

  const value: I18nContextValue = {
    locale,
    setLocale,
    t,
    isRtl: locale === "ar",
    isLoading,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
