"use client";

import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n/context";

export function StorySection() {
  const { t } = useI18n();
  return (
    <section id="story" className="scroll-mt-24 px-4 py-16 md:px-8 md:py-24">
      <div className="mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-2xl border px-8 py-12 md:px-12 md:py-16"
          style={{
            background: "linear-gradient(135deg, rgba(5, 150, 105, 0.06) 0%, rgba(212, 184, 150, 0.08) 100%)",
            borderColor: "rgba(5, 150, 105, 0.2)",
          }}
        >
          <h2 className="text-base font-semibold uppercase tracking-wider text-[#059669] dark:text-[#10b981]">
            {t("landing.story.title")}
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-gray-800 dark:text-gray-200 md:text-xl">
            {t("landing.story.problem")}
          </p>
          <p className="mt-6 text-gray-600 dark:text-brand-stardustLight">
            {t("landing.story.conclusion")}
          </p>
        </motion.div>
      </div>
    </section>
  );
}
