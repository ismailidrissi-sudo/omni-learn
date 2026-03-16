"use client";

import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n/context";

const domains = [
  { nameKey: "landing.domains.esg", color: "#059669", icon: "🌱" },
  { nameKey: "landing.domains.foodSafety", color: "#D4B896", icon: "🍽️" },
  { nameKey: "landing.domains.softSkills", color: "#10b981", icon: "💬" },
  { nameKey: "landing.domains.operationalExcellence", color: "#C4A574", icon: "⚙️" },
  { nameKey: "landing.domains.marketing", color: "#059669", icon: "📢" },
];

export function DomainExpertise() {
  const { t } = useI18n();
  return (
    <section id="solutions" className="scroll-mt-24 px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-6xl">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-4 text-center text-3xl font-bold text-gray-900 dark:text-brand-heading md:text-4xl"
        >
          {t("landing.domains.title")}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto mb-16 max-w-2xl text-center text-gray-600 dark:text-brand-stardustLight"
        >
          {t("landing.domains.subtitle")}
        </motion.p>

        <div className="flex flex-wrap justify-center gap-4 md:flex-nowrap md:overflow-x-auto md:gap-6 md:pb-4 md:scrollbar-hide">
          {domains.map((domain, i) => (
            <motion.div
              key={domain.nameKey}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ scale: 1.02 }}
              className="flex min-w-[160px] flex-1 flex-col items-center rounded-xl border p-6 md:min-w-[180px] md:flex-none bg-white dark:bg-[#1a1e18]"
              style={{ borderColor: `${domain.color}33` }}
            >
              <span className="text-3xl">{domain.icon}</span>
              <span
                className="mt-3 font-semibold"
                style={{ color: domain.color }}
              >
                {t(domain.nameKey)}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
