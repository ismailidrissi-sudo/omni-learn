"use client";

import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n/context";

export function MissionSection() {
  const { t } = useI18n();
  return (
    <section id="mission" className="scroll-mt-24 px-4 py-16 md:px-8 md:py-24">
      <div className="mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-2xl border px-8 py-12 text-center md:px-12 md:py-16"
          style={{
            background: "linear-gradient(135deg, rgba(5, 150, 105, 0.08) 0%, rgba(212, 184, 150, 0.1) 100%)",
            borderColor: "rgba(5, 150, 105, 0.25)",
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{
              background: "radial-gradient(circle at 30% 50%, #059669 0%, transparent 50%)",
            }}
          />
          <div className="relative">
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-base font-semibold uppercase tracking-wider text-[#059669] dark:text-[#10b981]"
            >
              {t("landing.mission.title")}
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="mt-4 text-xl font-medium leading-relaxed text-gray-800 dark:text-gray-200 md:text-2xl md:leading-relaxed"
            >
              {t("home.mission")}
            </motion.p>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="mt-6 text-sm text-gray-600 dark:text-brand-stardustLight"
            >
              {t("landing.mission.byline")}
            </motion.p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
