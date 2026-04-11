"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { usePermissions } from "@/hooks/use-permissions";
import { useI18n } from "@/lib/i18n/context";
import { LearnLogo } from "@/components/ui/learn-logo";
import { NavToggles } from "@/components/ui/nav-toggles";

type Section = {
  labelKey: string;
  href: string;
  permission: string | null;
  icon: ReactNode;
};

const ICON_DASHBOARD = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
  </svg>
);
const ICON_APPROVALS = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const ICON_DOMAINS = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z" />
  </svg>
);
const ICON_PATHS = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503-10.053a23.955 23.955 0 00-11.006 0l-.503.109A1.867 1.867 0 003 9.127V18.75l.832-.555a23.927 23.927 0 0116.336 0L21 18.75V9.127c0-.89-.631-1.656-1.505-1.825l-.503-.109z" />
  </svg>
);
const ICON_CONTENT = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
  </svg>
);
const ICON_USERS = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128H9m6 0a5.97 5.97 0 01-.786-3.07M9 19.128v-.003c0-1.113.285-2.16.786-3.07M9 19.128H3.75A2.25 2.25 0 011.5 16.878v-.003c0-1.032.38-1.974 1.006-2.695A4.126 4.126 0 017.5 9.75a4.126 4.126 0 014.994 4.43M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
  </svg>
);
const ICON_COMPANY = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5M3.75 3v18m4.5-18v18m4.5-18v18m4.5-18v18M6 6.75h.008M6 9.75h.008M6 12.75h.008M6 15.75h.008M10.5 6.75h.008M10.5 9.75h.008M10.5 12.75h.008M10.5 15.75h.008M15 6.75h.008M15 9.75h.008M15 12.75h.008M15 15.75h.008" />
  </svg>
);
const ICON_NEXUS = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72l1.189-1.19A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72M6.75 18h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .414.336.75.75.75z" />
  </svg>
);
const ICON_ANALYTICS = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>
);
const ICON_EMAIL = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
  </svg>
);
const ICON_SETTINGS = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.248a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.282c-.062-.373-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const ICON_LABEL = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
  </svg>
);

function buildSections(): Section[] {
  return [
    { labelKey: "admin.sectionDashboard", href: "/admin/dashboard", permission: null, icon: ICON_DASHBOARD },
    { labelKey: "admin.sectionApprovals", href: "/admin/approvals", permission: "approvals:review", icon: ICON_APPROVALS },
    { labelKey: "admin.sectionDomains", href: "/admin/domains", permission: "domains:create", icon: ICON_DOMAINS },
    { labelKey: "admin.sectionPaths", href: "/admin/paths", permission: "paths:create", icon: ICON_PATHS },
    { labelKey: "admin.sectionContent", href: "/admin/content", permission: "courses:create", icon: ICON_CONTENT },
    { labelKey: "admin.sectionUsers", href: "/admin/users", permission: "users:manage", icon: ICON_USERS },
    { labelKey: "admin.sectionCompany", href: "/admin/company", permission: "companies:manage", icon: ICON_COMPANY },
    { labelKey: "admin.sectionMyCompany", href: "/admin/nexus", permission: "company:manage_own", icon: ICON_NEXUS },
    { labelKey: "admin.sectionAnalytics", href: "/admin/analytics", permission: "admin:analytics", icon: ICON_ANALYTICS },
    { labelKey: "admin.sectionEmail", href: "/admin/email", permission: "admin:smtp", icon: ICON_EMAIL },
    { labelKey: "admin.sectionSettings", href: "/admin/settings/email", permission: "admin:settings", icon: ICON_SETTINGS },
    { labelKey: "admin.sectionPrivateLabel", href: "/admin/settings/private-label", permission: "company:manage_branding", icon: ICON_LABEL },
  ];
}

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { permissions, loading: permissionsLoading } = usePermissions();
  const { t } = useI18n();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const panelId = useId();

  const granted = useMemo(() => new Set(permissions), [permissions]);

  const sections = useMemo(() => buildSections(), []);

  const visible = useMemo(
    () => permissionsLoading
      ? sections.filter((s) => s.permission === null)
      : sections.filter((s) => s.permission === null || granted.has(s.permission)),
    [sections, granted, permissionsLoading],
  );

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  useEffect(() => {
    closeSidebar();
  }, [pathname, closeSidebar]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSidebar();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [sidebarOpen, closeSidebar]);

  const navContent = (
    <nav className="flex flex-col gap-0.5">
      {visible.map((s) => {
        const active = pathname === s.href || pathname.startsWith(`${s.href}/`);
        return (
          <Link
            key={s.href}
            href={s.href}
            onClick={closeSidebar}
            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
              active
                ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
                : "text-[var(--color-text-primary)] hover:bg-[var(--color-bg-primary)]"
            }`}
          >
            <span className={`shrink-0 ${active ? "text-[var(--color-accent)]" : "text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)]"} transition-colors`}>
              {s.icon}
            </span>
            <span className="truncate">{t(s.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );

  const sidebarInner = (
    <>
      <Link
        href="/learn"
        className="text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors mb-4 inline-flex items-center gap-1"
      >
        {t("admin.backToLearning")}
      </Link>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-secondary)] mb-3 px-1">
        {t("admin.shellTitle")}
      </p>
      {navContent}
    </>
  );

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      {/* Top bar — always visible (mobile + desktop) */}
      <header className="sticky top-0 z-40 border-b border-[var(--color-bg-secondary)] bg-[var(--color-bg-primary)]/95 backdrop-blur-sm px-4 py-3 md:px-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile sidebar toggle */}
          <button
            type="button"
            className="md:hidden p-2 -ml-2 rounded-lg text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
            aria-expanded={sidebarOpen}
            aria-controls={panelId}
            aria-label={t("admin.shellTitle")}
            onClick={() => setSidebarOpen((v) => !v)}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              {sidebarOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
          <Link href="/" className="shrink-0">
            <LearnLogo size="sm" />
          </Link>
          <span className="hidden sm:inline text-sm font-semibold text-[var(--color-text-primary)] truncate">
            {t("admin.shellTitle")}
          </span>
        </div>
        <NavToggles />
      </header>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-[var(--color-bg-secondary)] bg-[var(--color-bg-secondary)]/50 p-4 gap-1 sticky top-[57px] h-[calc(100vh-57px)] overflow-y-auto scrollbar-hide">
          {sidebarInner}
        </aside>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && typeof document !== "undefined" &&
          createPortal(
            <div className="fixed inset-0 z-[100] md:hidden" role="dialog" aria-modal="true" aria-label={t("admin.shellTitle")}>
              <button
                type="button"
                className="absolute inset-0 bg-black/40"
                aria-label={t("admin.close")}
                onClick={closeSidebar}
              />
              <div
                id={panelId}
                className="relative flex h-full w-full max-w-[280px] flex-col bg-[var(--color-bg-primary)] shadow-xl border-r border-[var(--color-bg-secondary)] animate-[slideInLeft_0.2s_ease-out]"
              >
                <div className="flex items-center justify-between border-b border-[var(--color-bg-secondary)] px-4 py-3">
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">{t("admin.shellTitle")}</span>
                  <button
                    type="button"
                    className="rounded-lg p-2 hover:bg-[var(--color-bg-secondary)] transition-colors"
                    aria-label={t("admin.close")}
                    onClick={closeSidebar}
                  >
                    <svg className="h-5 w-5 text-[var(--color-text-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
                  {sidebarInner}
                </div>
              </div>
            </div>,
            document.body,
          )}

        {/* Main content */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
