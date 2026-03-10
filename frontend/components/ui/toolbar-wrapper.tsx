"use client";

import { usePathname } from "next/navigation";
import { GlobalToolbar } from "./global-toolbar";

/**
 * Shows GlobalToolbar only on pages that don't have the toggles in their header (e.g. landing page has them in LandingHeader).
 */
export function ToolbarWrapper() {
  const pathname = usePathname();
  const isLanding = pathname === "/";
  if (isLanding) return null;
  return <GlobalToolbar />;
}
