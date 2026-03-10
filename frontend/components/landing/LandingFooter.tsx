"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { OmnilearnLogo } from "@/components/ui/omnilearn-logo";
import { useI18n } from "@/lib/i18n/context";

const footerLinks = [
  { href: "#story", labelKey: "landing.footer.story", isHash: true },
  { href: "#platform", labelKey: "landing.footer.platform", isHash: true },
  { href: "#solutions", labelKey: "landing.footer.solutions", isHash: true },
  { href: "#enterprise", labelKey: "landing.footer.enterprise", isHash: true },
  { href: "#pricing", labelKey: "landing.footer.pricing", isHash: true },
  { href: "/signin", labelKey: "landing.footer.signIn", isHash: false },
  { href: "/signup", labelKey: "landing.footer.signUp", isHash: false },
  { href: "/terms", labelKey: "landing.footer.terms", isHash: false },
  { href: "/privacy", labelKey: "landing.footer.privacy", isHash: false },
  { href: "/about", labelKey: "landing.footer.about", isHash: false },
  { href: "/what-we-offer", labelKey: "landing.footer.whatWeOffer", isHash: false },
  { href: "/press", labelKey: "landing.footer.press", isHash: false },
  { href: "/contact", labelKey: "landing.footer.contact", isHash: false },
  { href: "/modern-slavery", labelKey: "landing.footer.modernSlavery", isHash: false },
];

const linkClass =
  "text-sm text-[#C4A574] dark:text-[#D4B896] transition-colors hover:text-[#1a1212] dark:hover:text-[#F5F5DC]";

export function LandingFooter() {
  const { t } = useI18n();
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <footer className="border-t border-[#D4B896]/30 dark:border-[#D4B896]/10 px-4 py-12 md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between">
          <div className="flex items-center justify-center md:justify-start w-full md:w-auto">
            <Link href="/">
              <OmnilearnLogo size="sm" variant="light" />
            </Link>
          </div>
          <div className="flex flex-wrap justify-center gap-6 md:gap-8">
            {footerLinks.map((link) => {
              const href = link.isHash && !isHome ? `/${link.href}` : link.href;
              if (link.isHash && isHome) {
                return (
                  <a
                    key={link.labelKey}
                    href={href}
                    className={linkClass}
                    onClick={(e) => {
                      const el = document.querySelector(link.href);
                      if (el) {
                        e.preventDefault();
                        el.scrollIntoView({ behavior: "smooth" });
                      }
                    }}
                  >
                    {t(link.labelKey)}
                  </a>
                );
              }
              return (
                <Link key={link.labelKey} href={href} className={linkClass}>
                  {t(link.labelKey)}
                </Link>
              );
            })}
          </div>
          <p className="text-center text-sm text-[#C4A574] dark:text-[#D4B896] md:text-right">
            {t("landing.footer.copyright", { year: String(new Date().getFullYear()) })}
          </p>
        </div>
      </div>
    </footer>
  );
}
