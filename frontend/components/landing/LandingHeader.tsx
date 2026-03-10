"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { OmnilearnLogo } from "@/components/ui/omnilearn-logo";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useI18n } from "@/lib/i18n/context";

const navLinks = [
  { href: "#story", labelKey: "landing.nav.story" },
  { href: "#platform", labelKey: "landing.nav.platform" },
  { href: "#solutions", labelKey: "landing.nav.solutions" },
  { href: "#enterprise", labelKey: "landing.nav.enterprise" },
  { href: "#pricing", labelKey: "landing.nav.pricing" },
];

export function LandingHeader() {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50"
    >
      <div
        className="mx-4 mt-4 rounded-2xl border border-[#D4B896]/30 bg-[#1a1e18]/90 backdrop-blur-xl md:mx-8 md:mt-6"
        style={{ background: "rgba(15, 21, 16, 0.9)" }}
      >
        <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4">
          <Link href="/" className="flex-shrink-0">
            <OmnilearnLogo size="sm" variant="dark" />
          </Link>

          {/* Burger button - top right */}
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex flex-col justify-center gap-1.5 w-10 h-10 rounded-lg hover:bg-[#F5F5DC]/10 transition-colors p-2"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            <span className={`block w-5 h-0.5 rounded-full bg-[#F5F5DC] transition-all ${menuOpen ? "rotate-45 translate-y-2" : ""}`} />
            <span className={`block w-5 h-0.5 rounded-full bg-[#F5F5DC] transition-all ${menuOpen ? "opacity-0" : ""}`} />
            <span className={`block w-5 h-0.5 rounded-full bg-[#F5F5DC] transition-all ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
          </button>
        </div>

        {/* Dropdown menu */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-[#D4B896]/20"
            >
              <nav className="flex flex-col px-4 py-4 gap-1">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="py-3 px-3 rounded-lg text-sm font-medium text-[#F5F5DC] hover:bg-[#F5F5DC]/10 transition-colors"
                    onClick={(e) => {
                      const el = document.querySelector(link.href);
                      if (el) {
                        e.preventDefault();
                        el.scrollIntoView({ behavior: "smooth" });
                        closeMenu();
                      }
                    }}
                  >
                    {t(link.labelKey)}
                  </a>
                ))}
                <div className="h-px bg-[#D4B896]/30 my-2" />
                <Link
                  href="/trainer"
                  className="py-3 px-3 rounded-lg text-sm font-medium text-[#F5F5DC] hover:bg-[#F5F5DC]/10 transition-colors"
                  onClick={closeMenu}
                >
                  {t("nav.trainer")}
                </Link>
                <Link
                  href="/signin"
                  className="py-3 px-3 rounded-lg text-sm font-medium text-[#F5F5DC] hover:bg-[#F5F5DC]/10 transition-colors"
                  onClick={closeMenu}
                >
                  {t("landing.nav.signIn")}
                </Link>
                <Link
                  href="/signup"
                  className="py-3 px-3 rounded-lg text-sm font-medium text-[#F5F5DC] hover:bg-[#F5F5DC]/10 transition-colors"
                  onClick={closeMenu}
                >
                  {t("landing.nav.signUp")}
                </Link>
                <div className="h-px bg-[#D4B896]/30 my-2" />
                <div className="py-3 px-3 rounded-lg text-sm font-medium text-[#F5F5DC] hover:bg-[#F5F5DC]/10 transition-colors [&_button]:w-full [&_button]:text-left [&_button]:text-inherit [&_button]:font-medium [&_button]:py-0 [&_button]:min-h-0 [&_button]:justify-start [&_button]:rounded-lg [&_button]:hover:bg-transparent">
                  <LanguageToggle />
                </div>
                <div className="py-3 px-3 rounded-lg text-sm font-medium text-[#F5F5DC] hover:bg-[#F5F5DC]/10 transition-colors [&_button]:w-full [&_button]:text-left [&_button]:text-inherit [&_button]:font-medium [&_button]:py-0 [&_button]:min-h-0 [&_button]:justify-start [&_button]:rounded-lg [&_button]:hover:bg-[#F5F5DC]/10">
                  <ThemeToggle />
                </div>
                <Link
                  href="/signup"
                  className="mt-2 inline-flex h-10 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all hover:opacity-90"
                  style={{
                    background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                  }}
                  onClick={closeMenu}
                >
                  {t("landing.nav.bookDemo")}
                </Link>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  );
}
