"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { apiFetch } from "@/lib/api";
import { formatUserCount } from "@/lib/format-user-count";

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

export function TrustBar() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [brokenLogos, setBrokenLogos] = useState<Set<string>>(new Set());

  useEffect(() => {
    apiFetch("/company/stats")
      .then((res) => res.json())
      .then((data: PlatformStats) => {
        setStats(data);
      })
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  const handleImgError = useCallback((id: string) => {
    setBrokenLogos((prev) => new Set(prev).add(id));
  }, []);

  const companies = stats?.trustedCompanies ?? [];
  const dedupedCompanies = companies.filter(
    (c, i, arr) => arr.findIndex((o) => o.name === c.name) === i,
  );
  const hasLogos = dedupedCompanies.length > 0;
  const items = hasLogos
    ? dedupedCompanies
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

      <div className="mx-auto max-w-5xl px-4">
        <div className="flex flex-wrap items-center justify-center gap-12 md:gap-16">
          {items.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="flex items-center justify-center min-h-[7rem] md:min-h-[8.5rem] flex-shrink-0 py-2"
            >
              {item.logoUrl && !brokenLogos.has(item.id) ? (
                <img
                  src={item.logoUrl}
                  alt={item.name}
                  title={item.name}
                  className="h-20 w-auto max-w-[240px] md:h-24 md:max-w-[300px] object-contain object-center transition-all duration-300 mix-blend-multiply dark:brightness-0 dark:invert dark:opacity-80 hover:scale-105"
                  loading="lazy"
                  onError={() => handleImgError(item.id)}
                />
              ) : (
                <span
                  className="text-xl md:text-2xl font-semibold text-[#C4A574] dark:text-[#F5F5DC]/40 text-center max-w-[280px]"
                  title={item.name}
                >
                  {item.name}
                </span>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
