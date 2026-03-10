"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type Branding = {
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  customCss?: string;
};

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<Branding | null>(null);

  useEffect(() => {
    fetch(`${API}/company/tenants`)
      .then((r) => r.json())
      .then((tenants: { id: string }[]) => {
        const first = Array.isArray(tenants) ? tenants[0] : null;
        if (first) {
          return fetch(`${API}/company/tenants/${first.id}/branding`).then((r) => r.json());
        }
        return null;
      })
      .then(setBranding)
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
