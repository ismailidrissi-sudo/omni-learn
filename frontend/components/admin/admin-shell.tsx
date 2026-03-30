"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { usePermissions } from "@/hooks/use-permissions";

type Section = { label: string; href: string; permission: string | null };

const ADMIN_SECTIONS: Section[] = [
  { label: "Dashboard", href: "/admin/dashboard", permission: null },
  { label: "Approvals", href: "/admin/approvals", permission: "approvals:review" },
  { label: "Domains", href: "/admin/domains", permission: "domains:create" },
  { label: "Learning paths", href: "/admin/paths", permission: "paths:create" },
  { label: "Courses & content", href: "/admin/content", permission: "courses:create" },
  { label: "Users & requests", href: "/admin/users", permission: "users:manage" },
  { label: "Company (platform)", href: "/admin/company", permission: "companies:manage" },
  { label: "My company", href: "/admin/nexus", permission: "company:manage_own" },
  { label: "Analytics", href: "/admin/analytics", permission: "admin:analytics" },
  { label: "Email", href: "/admin/email", permission: "admin:smtp" },
  { label: "Settings", href: "/admin/settings/email", permission: "admin:settings" },
  { label: "Private label", href: "/admin/settings/private-label", permission: "company:manage_branding" },
];

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { permissions } = usePermissions();
  const granted = new Set(permissions);

  const visible = ADMIN_SECTIONS.filter(
    (s) => s.permission === null || granted.has(s.permission),
  );

  return (
    <div className="min-h-screen flex bg-[var(--color-bg-primary)]">
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 gap-1">
        <Link
          href="/learn"
          className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] mb-4"
        >
          ← Back to learning
        </Link>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-2">
          Admin
        </p>
        {visible.map((s) => {
          const active = pathname === s.href || pathname.startsWith(`${s.href}/`);
          return (
            <Link
              key={s.href}
              href={s.href}
              className={`rounded-md px-3 py-2 text-sm ${
                active
                  ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)] font-medium"
                  : "text-[var(--color-text-primary)] hover:bg-[var(--color-bg-primary)]"
              }`}
            >
              {s.label}
            </Link>
          );
        })}
      </aside>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
