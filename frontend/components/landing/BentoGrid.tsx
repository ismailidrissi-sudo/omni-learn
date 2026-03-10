"use client";

import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n/context";

const cardKeys = [
  { titleKey: "landing.bento.aiPaths", descKey: "landing.bento.aiPathsDesc", icon: "◇" },
  { titleKey: "landing.bento.multiTenant", descKey: "landing.bento.multiTenantDesc", icon: "◆" },
  { titleKey: "landing.bento.scorm", descKey: "landing.bento.scormDesc", icon: "▣" },
  { titleKey: "landing.bento.microlearning", descKey: "landing.bento.microlearningDesc", icon: "✦" },
  { titleKey: "landing.bento.gamification", descKey: "landing.bento.gamificationDesc", icon: "★" },
  { titleKey: "landing.bento.socialLearning", descKey: "landing.bento.socialLearningDesc", icon: "◈" },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export function BentoGrid() {
  const { t } = useI18n();
  return (
    <section id="platform" className="scroll-mt-24 px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-6xl">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-4 text-center text-3xl font-bold text-gray-900 dark:text-brand-heading md:text-4xl"
        >
          {t("landing.bento.title")}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto mb-16 max-w-2xl text-center text-gray-600 dark:text-brand-stardustLight"
        >
          {t("landing.bento.subtitle")}
        </motion.p>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          {cardKeys.map((card, i) => (
            <motion.div
              key={card.titleKey}
              variants={item}
              whileHover={{ y: -4 }}
              className="rounded-xl border p-6 transition-shadow hover:shadow-lg"
              style={{
                background: "#1a1e18",
                borderColor: "rgba(5, 150, 105, 0.2)",
              }}
            >
              <span className="text-2xl text-[#059669]">{card.icon}</span>
              <h3 className="mt-4 text-xl font-semibold text-brand-heading">
                {t(card.titleKey)}
              </h3>
              <p className="mt-2 text-brand-stardustLight">{t(card.descKey)}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
