"use client";

import Link from "next/link";
import { Shield, ChevronRight } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { ADMIN_NAV_ANY_PERMISSIONS } from "@/lib/permissions";

export function AdminNavButton() {
  const { hasAny, resolveAdminLabel } = usePermissions();

  const isAdmin = hasAny(ADMIN_NAV_ANY_PERMISSIONS);

  if (!isAdmin) return null;

  return (
    <Link
      href="/admin/dashboard"
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
    >
      <Shield className="h-5 w-5 shrink-0 text-[var(--color-accent)]" aria-hidden />
      <span className="flex-1">{resolveAdminLabel()}</span>
      <ChevronRight className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
    </Link>
  );
}
