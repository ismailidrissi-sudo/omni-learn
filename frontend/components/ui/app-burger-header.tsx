"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { NavToggles } from "@/components/ui/nav-toggles";

export type BurgerNavItem = {
  href: string;
  label: string;
  match?: "exact" | "prefix";
  inactiveVariant?: "ghost" | "outline";
};

function itemActive(pathname: string, item: BurgerNavItem): boolean {
  if (item.match === "prefix") {
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }
  return pathname === item.href;
}

/** When several prefix rules match (e.g. /admin vs /admin/nexus), only the longest href wins */
function primaryIndex(pathname: string, items: BurgerNavItem[]): number {
  let best = -1;
  let bestLen = -1;
  items.forEach((item, i) => {
    if (!itemActive(pathname, item)) return;
    if (item.href.length > bestLen) {
      bestLen = item.href.length;
      best = i;
    }
  });
  return best;
}

function buttonVariant(item: BurgerNavItem, active: boolean): "primary" | "ghost" | "outline" {
  if (active) return "primary";
  return item.inactiveVariant === "outline" ? "outline" : "ghost";
}

export type AppBurgerHeaderProps = {
  logoHref: string;
  logo: React.ReactNode;
  /** Shown next to logo, inside the same link as the logo */
  title?: React.ReactNode;
  /** e.g. breadcrumb segment; not part of the logo link */
  contextSlot?: React.ReactNode;
  items: BurgerNavItem[];
  borderClassName?: string;
  className?: string;
  headerClassName?: string;
  sticky?: boolean;
  /** e.g. profile avatar — always visible in the top bar */
  trailing?: React.ReactNode;
  /** Extra controls before the burger (e.g. course outline toggle) */
  beforeMenu?: React.ReactNode;
  /** Main bar center (e.g. course title); when set, logo block does not grow */
  center?: React.ReactNode;
  menuLabel?: string;
};

export function AppBurgerHeader({
  logoHref,
  logo,
  title,
  contextSlot,
  items,
  borderClassName = "border-b border-brand-grey-light",
  className = "",
  headerClassName = "px-6 py-4 flex justify-between items-center gap-3",
  sticky = false,
  trailing,
  beforeMenu,
  center,
  menuLabel = "Open menu",
}: AppBurgerHeaderProps) {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    close();
  }, [pathname, close]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  const hasMenu = items.length > 0;
  const activeIdx = hasMenu ? primaryIndex(pathname, items) : -1;

  return (
    <>
      <header
        className={`${borderClassName} ${sticky ? "sticky top-0 z-40 bg-white/95 dark:bg-[#0f1510]/95 backdrop-blur-sm" : ""} ${headerClassName} ${className}`}
      >
        <div className={`flex min-w-0 items-center gap-3 ${center ? "shrink-0" : "flex-1"}`}>
          <Link href={logoHref} className="flex min-w-0 shrink items-center gap-3">
            {logo}
            {title ? (
              <span className="min-w-0 truncate font-bold text-[var(--color-text-primary,#1a1212)] dark:text-[#F5F5DC]">
                {title}
              </span>
            ) : null}
          </Link>
          {contextSlot}
        </div>

        {center ? (
          <div className="min-w-0 flex-1 px-2 text-center sm:px-3">{center}</div>
        ) : null}

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {trailing}
          {beforeMenu}
          <NavToggles />
          {hasMenu && (
            <button
              type="button"
              className="p-2 rounded-lg border border-brand-grey-light dark:border-white/15 hover:bg-brand-grey-light/40 dark:hover:bg-white/10 text-[var(--color-text-primary,#1a1212)] dark:text-[#F5F5DC] transition-colors"
              aria-expanded={open}
              aria-controls={panelId}
              aria-label={menuLabel}
              onClick={() => setOpen((v) => !v)}
            >
              <span className="sr-only">{menuLabel}</span>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                {open ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          )}
        </div>
      </header>

      {hasMenu && open && typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[100] md:flex md:justify-end" role="dialog" aria-modal="true" aria-label="Navigation menu">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label="Close menu"
              onClick={close}
            />
            <div
              id={panelId}
              className="relative ml-auto flex h-full w-full max-w-sm flex-col border-l border-brand-grey-light dark:border-white/10 bg-white shadow-xl dark:bg-[#0f1510]"
            >
              <div className="flex items-center justify-between border-b border-brand-grey-light dark:border-white/10 px-4 py-3">
                <span className="text-sm font-semibold text-[var(--color-text-primary,#1a1212)] dark:text-[#F5F5DC]">Menu</span>
                <button
                  type="button"
                  className="rounded-lg p-2 hover:bg-brand-grey-light/50 dark:hover:bg-white/10"
                  aria-label="Close menu"
                  onClick={close}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
                {items.map((item, i) => {
                  const active = i === activeIdx;
                  return (
                    <Link key={item.href + item.label} href={item.href} onClick={close} className="block w-full">
                      <Button variant={buttonVariant(item, active)} size="sm" className="w-full justify-start">
                        {item.label}
                      </Button>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
