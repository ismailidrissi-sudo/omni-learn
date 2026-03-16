"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { apiFetch } from "@/lib/api";

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

interface PlatformStats {
  userCount: number;
  trustedCompanies: TrustedCompany[];
}

function formatUserCount(count: number): string {
  if (count >= 1_000_000) {
    const millions = Math.floor(count / 1_000_000);
    return `${millions.toLocaleString("en-US")},000,000+`;
  }
  if (count >= 1_000) {
    const thousands = Math.floor(count / 1_000) * 1_000;
    return `${thousands.toLocaleString("en-US")}+`;
  }
  return `${count}+`;
}

export function TrustBar() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/company/stats")
      .then((res) => res.json())
      .then((data: PlatformStats) => {
        setStats(data);
      })
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  const companies = stats?.trustedCompanies ?? [];
  const hasLogos = companies.length > 0;
  const items = hasLogos
    ? companies
    : PLACEHOLDER_NAMES.map((name, i) => ({
        id: `ph-${i}`,
        name,
        logoUrl: "" as string,
      }));

  const userCount = stats?.userCount ?? 0;
  const displayCount = userCount > 0 ? formatUserCount(userCount) : "2,000,000+";

  return (
    <section className="border-y border-[#D4B896]/30 dark:border-[#D4B896]/10 py-8 md:py-12">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="mb-8 text-center px-4"
      >
        <p className="text-sm font-medium text-gray-600 dark:text-brand-stardustLight">
          Loved by{" "}
          <span className="font-bold text-[#059669] dark:text-[#10b981]">
            {loading ? (
              <span className="inline-block w-24 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse align-middle" />
            ) : (
              displayCount
            )}
          </span>{" "}
          users and trusted by teams at :
        </p>
      </motion.div>

      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-16 bg-gradient-to-r from-[#F5F5DC] dark:from-[#0f1510] to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-16 bg-gradient-to-l from-[#F5F5DC] dark:from-[#0f1510] to-transparent" />

        <div className="flex animate-marquee gap-16 whitespace-nowrap items-center">
          {[...items, ...items].map((item, i) => (
            <div
              key={`${item.id}-${i}`}
              className="flex items-center justify-center min-w-[140px] h-12 flex-shrink-0"
            >
              {item.logoUrl ? (
                <img
                  src={item.logoUrl}
                  alt={item.name}
                  title={item.name}
                  className="h-9 w-auto max-w-[130px] object-contain object-center opacity-60 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-300"
                  loading="lazy"
                />
              ) : (
                <span
                  className="text-lg font-semibold text-[#C4A574] dark:text-[#F5F5DC]/40"
                  title={item.name}
                >
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
