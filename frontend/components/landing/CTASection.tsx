"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n/context";

export function CTASection() {
  const { t } = useI18n();
  return (
    <section className="scroll-mt-24 px-4 py-20 md:px-8 md:py-28">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl border px-8 py-16 text-center md:px-16 md:py-20"
        style={{
          background: "linear-gradient(135deg, rgba(5, 150, 105, 0.15) 0%, rgba(212, 184, 150, 0.12) 100%)",
          borderColor: "rgba(5, 150, 105, 0.35)",
          boxShadow: "0 0 60px rgba(5, 150, 105, 0.2)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background: "radial-gradient(circle at 50% 50%, #059669 0%, transparent 60%)",
          }}
        />
        <div className="relative">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-brand-heading md:text-4xl">
            {t("landing.cta.headline")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-gray-600 dark:text-brand-stardustLight">
            {t("landing.cta.subtitle")}
          </p>
          <Link
            href="/signup"
            className="mt-8 inline-flex items-center justify-center rounded-lg px-8 py-4 text-base font-semibold text-white transition-all hover:opacity-90"
            style={{
              background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
            }}
          >
            {t("landing.cta.bookDemo")}
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
