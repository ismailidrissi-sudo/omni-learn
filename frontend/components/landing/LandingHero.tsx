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
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="relative overflow-hidden rounded-2xl border shadow-2xl"
              style={{
                background: "#1a1e18",
                borderColor: "rgba(5, 150, 105, 0.3)",
                boxShadow:
                  "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 80px -20px rgba(5, 150, 105, 0.15)",
              }}
            >
              {/* Window chrome */}
              <div className="flex items-center px-4 py-2.5 border-b border-white/[0.06]">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#ff5f57]" />
                  <div className="w-2 h-2 rounded-full bg-[#febc2e]" />
                  <div className="w-2 h-2 rounded-full bg-[#28c840]" />
                </div>
                <div className="flex gap-4 ml-4">
                  <span className="text-[10px] font-medium text-[#10b981]">Dashboard</span>
                  <span className="text-[10px] text-gray-600">Courses</span>
                  <span className="text-[10px] text-gray-600">Paths</span>
                </div>
              </div>

              <div className="p-3.5 space-y-2.5">
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { label: "Streak", value: "12", icon: "🔥", color: "#10b981" },
                    { label: "XP", value: "2,450", icon: "⭐", color: "#F5F5DC" },
                    { label: "Done", value: "7", icon: "✓", color: "#D4B896" },
                  ] as const).map((stat, i) => (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.8 + i * 0.1 }}
                      className="rounded-lg bg-white/[0.03] p-2.5 border border-white/[0.05]"
                    >
                      <div className="text-[8px] uppercase tracking-wider text-gray-500">
                        {stat.label}
                      </div>
                      <div className="mt-1 flex items-center gap-1">
                        <span className="text-xs">{stat.icon}</span>
                        <span className="text-sm font-bold" style={{ color: stat.color }}>
                          {stat.value}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Continue Learning card */}
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.1 }}
                  className="rounded-lg bg-white/[0.03] p-3 border border-white/[0.05]"
                >
                  <div className="text-[8px] uppercase tracking-wider text-gray-500 mb-2">
                    Continue Learning
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#059669]/20 flex items-center justify-center shrink-0">
                      <span className="text-sm">📚</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-medium text-gray-200 truncate">
                        ESG Fundamentals
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                        <motion.div
                          initial={{ width: "0%" }}
                          animate={{ width: "72%" }}
                          transition={{ delay: 1.4, duration: 1.2, ease: "easeOut" }}
                          className="h-full rounded-full"
                          style={{
                            background: "linear-gradient(90deg, #059669, #10b981)",
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-[#10b981] shrink-0">
                      72%
                    </span>
                  </div>
                </motion.div>

                {/* Bottom row: Leaderboard + Badge */}
                <div className="grid grid-cols-5 gap-2">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.3 }}
                    className="col-span-3 rounded-lg bg-white/[0.03] p-3 border border-white/[0.05]"
                  >
                    <div className="text-[8px] uppercase tracking-wider text-gray-500 mb-2">
                      Leaderboard
                    </div>
                    <div className="space-y-1.5">
                      {([
                        { name: "Alex M.", pts: "3,210", bg: "#059669" },
                        { name: "You", pts: "2,450", bg: "#10b981" },
                        { name: "Sara K.", pts: "2,180", bg: "#D4B896" },
                      ] as const).map((entry, i) => (
                        <div
                          key={entry.name}
                          className={`flex items-center gap-2 ${
                            entry.name === "You"
                              ? "bg-[#059669]/10 rounded px-1.5 py-0.5 -mx-1.5"
                              : ""
                          }`}
                        >
                          <span className="text-[9px] text-gray-500 w-3">{i + 1}</span>
                          <div
                            className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white shrink-0"
                            style={{ background: entry.bg }}
                          >
                            {entry.name[0]}
                          </div>
                          <span
                            className={`text-[10px] flex-1 ${
                              entry.name === "You"
                                ? "font-semibold text-[#10b981]"
                                : "text-gray-400"
                            }`}
                          >
                            {entry.name}
                          </span>
                          <span className="text-[9px] text-gray-500">{entry.pts}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1.6, type: "spring", stiffness: 200, damping: 12 }}
                    className="col-span-2 rounded-lg bg-gradient-to-br from-[#059669]/20 to-[#059669]/5 p-3 border border-[#059669]/20 flex flex-col items-center justify-center text-center"
                  >
                    <span className="text-2xl">🏆</span>
                    <div className="text-[8px] uppercase tracking-wider text-[#10b981] mt-1.5 font-medium">
                      New Badge
                    </div>
                    <div className="text-[9px] text-gray-500 mt-0.5">ESG Pioneer</div>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
