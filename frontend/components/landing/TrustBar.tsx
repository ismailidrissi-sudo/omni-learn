"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n/context";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const PLACEHOLDER_NAMES = [
  "Food Safety Leaders",
  "Quality Excellence",
  "Operational Teams",
  "L&D Innovators",
  "Compliance Champions",
  "Growth Organizations",
  "Emerging Markets",
  "Enterprise Academy",
];

interface TrustedCompany {
  id: string;
  name: string;
  logoUrl: string;
}

export function TrustBar() {
  const { t } = useI18n();
  const [companies, setCompanies] = useState<TrustedCompany[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/company/trusted-by`)
      .then((res) => res.json())
      .then((data: TrustedCompany[]) => {
        setCompanies(Array.isArray(data) ? data : []);
      })
      .catch(() => setCompanies([]))
      .finally(() => setLoading(false));
  }, []);

  const hasLogos = companies.length > 0;
  const items = hasLogos
    ? companies
    : PLACEHOLDER_NAMES.map((name, i) => ({ id: `ph-${i}`, name, logoUrl: "" as string }));

  return (
    <section className="border-y border-[#D4B896]/30 dark:border-[#D4B896]/10 py-8 md:py-10">
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="mb-6 text-center text-sm text-gray-600 dark:text-brand-stardustLight"
      >
        {t("landing.trustBar")}
      </motion.p>
      <div className="relative overflow-hidden">
        <div className="flex animate-marquee gap-16 whitespace-nowrap items-center">
          {[...items, ...items].map((item, i) => (
            <div
              key={`${item.id}-${i}`}
              className="flex items-center justify-center min-w-[140px] h-10 flex-shrink-0"
            >
              {item.logoUrl ? (
                <img
                  src={item.logoUrl}
                  alt={item.name}
                  className="h-8 w-auto max-w-[120px] object-contain object-center opacity-70 grayscale hover:opacity-90 hover:grayscale-0 transition-all"
                  loading="lazy"
                />
              ) : (
                <span className="text-lg font-semibold text-[#C4A574] dark:text-[#F5F5DC]/40" title={item.name}>
                  {item.name}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
