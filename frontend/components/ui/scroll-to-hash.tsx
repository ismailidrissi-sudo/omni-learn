"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Scrolls to the element matching window.location.hash after navigation.
 * Fixes anchor links when navigating from other pages (e.g. /admin/nexus → /#pricing).
 */
export function ScrollToHash() {
  const pathname = usePathname();

  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (!hash) return;
    const id = hash.slice(1);
    if (!id) return;
    const scroll = () => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    requestAnimationFrame(() => setTimeout(scroll, 100));
  }, [pathname]);

  return null;
}
