"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type TenantBranding = {
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  appName?: string | null;
  tagline?: string | null;
  logoUrl?: string | null;
  /** True when logo bytes are stored in DB (served from API). */
  hasStoredLogo?: boolean;
  faviconUrl?: string | null;
  loginBgUrl?: string | null;
  fontFamily?: string | null;
  navStyle?: string | null;
  customCss?: string | null;
};

export type TenantPortal = {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  industry?: string | null;
  branding: TenantBranding | null;
  ssoProviders: string[];
  stats: { users: number; learningPaths: number; domains: number };
};

type TenantContextValue = {
  tenant: TenantPortal | null;
  branding: TenantBranding | null;
  tenantSlug: string;
  isLoading: boolean;
  error: string | null;
};

const TenantContext = createContext<TenantContextValue>({
  tenant: null,
  branding: null,
  tenantSlug: "",
  isLoading: true,
  error: null,
});

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function TenantProvider({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  const [tenant, setTenant] = useState<TenantPortal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    fetch(`${API_URL}/company/tenants/by-slug/${encodeURIComponent(slug)}/portal`)
      .then((res) => {
        if (!res.ok) throw new Error("Academy not found");
        return res.json();
      })
      .then((data: TenantPortal) => {
        setTenant(data);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load academy");
        setTenant(null);
      })
      .finally(() => setIsLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!tenant?.branding) return;
    const b = tenant.branding;
    const root = document.documentElement;

    if (b.primaryColor) {
      root.style.setProperty("--brand-green", b.primaryColor);
      root.style.setProperty("--brand-purple", b.primaryColor);
      root.style.setProperty("--color-accent", b.primaryColor);
    }
    if (b.secondaryColor) {
      root.style.setProperty("--brand-beige-dark", b.secondaryColor);
      root.style.setProperty("--brand-grey", b.secondaryColor);
    }
    if (b.accentColor) {
      root.style.setProperty("--color-accent", b.accentColor);
    }

    let styleEl: HTMLStyleElement | null = null;
    if (b.customCss) {
      styleEl = document.createElement("style");
      styleEl.textContent = b.customCss;
      document.head.appendChild(styleEl);
    }

    return () => {
      root.style.removeProperty("--brand-green");
      root.style.removeProperty("--brand-purple");
      root.style.removeProperty("--brand-beige-dark");
      root.style.removeProperty("--brand-grey");
      root.style.removeProperty("--color-accent");
      styleEl?.remove();
    };
  }, [tenant?.branding]);

  useEffect(() => {
    if (!tenant) return;
    const name = tenant.branding?.appName || tenant.name;
    document.title = `${name} Academy`;

    const favicon = tenant.branding?.faviconUrl;
    if (favicon) {
      let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = favicon;
    }
  }, [tenant]);

  return (
    <TenantContext.Provider
      value={{
        tenant,
        branding: tenant?.branding ?? null,
        tenantSlug: slug,
        isLoading,
        error,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}
