"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

type Branding = {
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  customCss?: string;
};

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<Branding | null>(null);

  useEffect(() => {
    // Must not use apiFetch: /company/tenants is SUPER_ADMIN-only; 401 there clears the session.
    fetch(`${API_URL}/company/default-branding`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b: Branding | null) => setBranding(b && typeof b === "object" ? b : null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!branding) return;
    const root = document.documentElement;
    if (branding.primaryColor) {
      root.style.setProperty("--brand-green", branding.primaryColor);
      root.style.setProperty("--brand-purple", branding.primaryColor);
    }
    if (branding.secondaryColor) {
      root.style.setProperty("--brand-beige-dark", branding.secondaryColor);
      root.style.setProperty("--brand-grey", branding.secondaryColor);
    }
    if (branding.customCss) {
      const style = document.createElement("style");
      style.textContent = branding.customCss;
      document.head.appendChild(style);
      return () => style.remove();
    }
  }, [branding]);

  return <>{children}</>;
}
