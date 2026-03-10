"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n/context";

export function LandingHero() {
  const { t } = useI18n();
  return (
    <section className="relative isolate overflow-hidden px-4 pt-32 pb-20 md:px-8 md:pt-40 md:pb-28">
      {/* Subtle gradient orbs */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, #059669 0%, transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute -right-20 top-1/3 h-60 w-60 rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, #D4B896 0%, transparent 70%)" }}
      />

      <div className="relative mx-auto max-w-6xl">
        <div className="flex flex-col items-center text-center lg:flex-row lg:items-start lg:gap-16 lg:text-left">
          <div className="flex-1">
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl font-bold leading-tight tracking-tight text-gray-900 dark:text-brand-heading md:text-5xl lg:text-6xl xl:text-7xl"
            >
              {t("landing.hero.headline1")}{" "}
              <span
                className="inline-block bg-clip-text text-transparent"
                style={{
                  backgroundImage: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {t("landing.hero.headline2")}
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="mt-6 max-w-2xl text-lg text-gray-700 dark:text-brand-stardustLight md:text-xl md:leading-relaxed"
            >
              {t("landing.hero.subheadline")}
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-center sm:gap-4 lg:justify-start"
            >
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-lg px-6 py-3.5 text-base font-semibold text-white shadow-lg transition-all hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#059669]/50 focus:ring-offset-2 dark:focus:ring-offset-[#0f1510]"
                style={{
                  background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                }}
              >
                {t("landing.hero.startTrial")}
              </Link>
              <a
                href="#platform"
                className="inline-flex items-center justify-center rounded-lg border border-[#D4B896] bg-[#F5F5DC] px-6 py-3.5 text-base font-semibold text-[#1a1212] transition-all hover:bg-[#D4B896]/30 dark:border-[#D4B896]/30 dark:bg-[#F5F5DC]/10 dark:text-[#F5F5DC] dark:backdrop-blur-sm dark:hover:bg-[#F5F5DC]/20"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById("platform")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                {t("landing.hero.exploreArchitecture")}
              </a>
            </motion.div>
          </div>

          {/* Dashboard mockup visual */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="mt-12 w-full max-w-lg flex-shrink-0 lg:mt-0"
          >
            <div
              className="relative overflow-hidden rounded-2xl border p-4 shadow-2xl"
              style={{
                background: "#1a1e18",
                borderColor: "rgba(5, 150, 105, 0.3)",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
              }}
            >
              {/* Mock dashboard UI */}
              <div className="flex gap-2">
                <div className="h-2 w-16 rounded-full bg-[#059669]/30" />
                <div className="h-2 w-24 rounded-full bg-[#059669]/20" />
                <div className="h-2 w-20 rounded-full bg-[#059669]/20" />
              </div>
              <div className="mt-6 grid grid-cols-3 gap-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="aspect-video rounded-lg"
                    style={{ background: "rgba(5, 150, 105, 0.15)" }}
                  />
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <div className="h-12 flex-1 rounded-lg bg-[#10b981]/20" />
                <div className="h-12 flex-1 rounded-lg bg-[#059669]/20" />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
