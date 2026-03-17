"use client";

import { useState, useEffect, useMemo } from "react";
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

const FALLBACK_DOMAINS: DomainItem[] = [
  { id: "fb-food", name: "Food Safety", color: "#0891b2", icon: "🔬" },
  { id: "fb-qm", name: "Quality Management", color: "#059669", icon: "✅" },
  { id: "fb-lead", name: "Leadership", color: "#7c3aed", icon: "🧠" },
  { id: "fb-ops", name: "Operational Excellence", color: "#ea580c", icon: "⚙️" },
  { id: "fb-mkt", name: "Digital Marketing", color: "#e11d48", icon: "📈" },
];

function deduplicateDomains(domains: DomainItem[]): DomainItem[] {
  const seen = new Map<string, DomainItem>();
  for (const d of domains) {
    const key = d.name.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.set(key, d);
    } else {
      const existing = seen.get(key)!;
      if (d._count && existing._count) {
        existing._count.learningPaths += d._count.learningPaths;
        existing._count.contentItems += d._count.contentItems;
      }
    }
  }
  return Array.from(seen.values());
}

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

  const uniqueDomains = useMemo(() => deduplicateDomains(domains), [domains]);

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

  if (uniqueDomains.length === 0) return null;

  const itemCount = (d: DomainItem) =>
    (d._count?.learningPaths ?? 0) + (d._count?.contentItems ?? 0);

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
          className="mx-auto mb-14 max-w-2xl text-center text-gray-600 dark:text-brand-stardustLight"
        >
          {t("landing.domains.subtitle")}
        </motion.p>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-5 lg:grid-cols-5">
          {uniqueDomains.map((domain, i) => {
            const count = itemCount(domain);
            return (
              <motion.div
                key={domain.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06, duration: 0.4 }}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="group flex flex-col items-center rounded-2xl border border-gray-100 bg-white px-4 py-8 shadow-sm transition-shadow hover:shadow-lg dark:border-white/10 dark:bg-[#1a1e18]"
              >
                <div
                  className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl text-2xl"
                  style={{ backgroundColor: `${domain.color}14` }}
                >
                  {domain.icon || "📚"}
                </div>
                <span
                  className="text-center text-sm font-semibold leading-tight"
                  style={{ color: domain.color }}
                >
                  {domain.name}
                </span>
                {count > 0 && (
                  <span className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                    {count} {t("landing.domains.items")}
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
