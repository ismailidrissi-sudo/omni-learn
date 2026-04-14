"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";

const TABS = [
  { href: "/trainer", segment: "profile", key: "trainer.tabs.profile" as const },
  { href: "/trainer/content", segment: "content", key: "trainer.tabs.content" as const },
  { href: "/trainer/stats", segment: "stats", key: "trainer.tabs.stats" as const },
  { href: "/trainer/settings", segment: "settings", key: "trainer.tabs.settings" as const },
] as const;

export function TrainerTabNav() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <div className="border-b border-black/[0.08] bg-[#FAFAF8] sticky top-0 z-20">
      <nav
        className="max-w-6xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto scrollbar-none py-2"
        aria-label={t("trainer.tabs.aria")}
      >
        {TABS.map((tab) => {
          const active =
            tab.href === "/trainer"
              ? pathname === "/trainer" || pathname === "/trainer/"
              : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={[
                "shrink-0 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap border-b-2 -mb-px",
                active
                  ? "text-[#1D9E75] border-[#1D9E75] font-medium"
                  : "text-[#6B7280] border-transparent hover:text-[#1A1A1A]",
              ].join(" ")}
            >
              {t(tab.key)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
