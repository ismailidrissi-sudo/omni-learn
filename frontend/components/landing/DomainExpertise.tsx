"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n/context";
import { apiFetch } from "@/lib/api";

type DomainItem = {
  id: string;
  name: string;
  icon?: string | null;
  color: string;
  description?: string | null;
  _count?: { learningPaths: number; contentItems: number };
};

const FALLBACK_DOMAINS = [
  { id: "fb-esg", name: "ESG", color: "#059669", icon: "🌱" },
  { id: "fb-food", name: "Food Safety", color: "#D4B896", icon: "🍽️" },
  { id: "fb-soft", name: "Soft Skills", color: "#10b981", icon: "💬" },
  { id: "fb-ops", name: "Operational Excellence", color: "#C4A574", icon: "⚙️" },
  { id: "fb-mkt", name: "Marketing", color: "#059669", icon: "📢" },
];

export function DomainExpertise() {
  const { t } = useI18n();
  const [domains, setDomains] = useState<DomainItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/domains?activeOnly=true")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          const arr = Array.isArray(data) ? data : [];
          setDomains(arr.length > 0 ? arr : FALLBACK_DOMAINS);
        }
      })
      .catch(() => {
        if (!cancelled) setDomains(FALLBACK_DOMAINS);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => { cancelled = true; };
  }, []);

  if (!loaded) {
    return (
      <section id="solutions" className="scroll-mt-24 px-4 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#059669] border-t-transparent" />
          </div>
        </div>
      </section>
    );
  }

  if (domains.length === 0) return null;

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
              key={domain.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ scale: 1.02 }}
              className="flex min-w-[160px] flex-1 flex-col items-center rounded-xl border p-6 md:min-w-[180px] md:flex-none bg-white dark:bg-[#1a1e18]"
              style={{ borderColor: `${domain.color}33` }}
            >
              <span className="text-3xl">{domain.icon || "📚"}</span>
              <span
                className="mt-3 font-semibold"
                style={{ color: domain.color }}
              >
                {domain.name}
              </span>
              {domain._count && (domain._count.learningPaths > 0 || domain._count.contentItems > 0) && (
                <span className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {domain._count.contentItems} {t("landing.domains.items")}
                </span>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
