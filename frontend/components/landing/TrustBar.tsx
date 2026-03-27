"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { apiFetch, apiAbsoluteMediaUrl } from "@/lib/api";
import { formatUserCount } from "@/lib/format-user-count";

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
  const items = dedupedCompanies.filter((c) => !!c.logoUrl);
  const visibleItems = items.filter((c) => !brokenLogos.has(c.id));

  const userCount = stats?.userCount ?? 0;
  const displayCount = userCount > 0 ? formatUserCount(userCount) : "2,000,000+";

  const renderItem = (item: (typeof items)[0], idx: number) => {
    if (!item.logoUrl || brokenLogos.has(item.id)) return null;

    return (
      <div
        key={`${item.id}-${idx}`}
        className="flex-shrink-0 px-6 md:px-10 flex items-center justify-center"
      >
        <img
          src={apiAbsoluteMediaUrl(item.logoUrl) ?? item.logoUrl}
          alt={item.name}
          title={item.name}
          className="h-8 w-auto max-w-[100px] md:h-10 md:max-w-[130px] object-contain object-center mix-blend-multiply dark:mix-blend-normal dark:brightness-0 dark:invert dark:opacity-80"
          loading="lazy"
          onError={() => handleImgError(item.id)}
        />
      </div>
    );
  };

  if (!loading && visibleItems.length === 0) return null;

  return (
    <section className="border-y border-[#D4B896]/30 dark:border-[#D4B896]/10 py-6 md:py-8">
      <style>{`
        @keyframes trustbar-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .trustbar-marquee {
          animation: trustbar-scroll 25s linear infinite;
        }
        .trustbar-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="mb-5 text-center px-4"
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
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-20 z-10 bg-gradient-to-r from-[#F5F5DC] to-transparent dark:from-[#0f1510]" />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-20 z-10 bg-gradient-to-l from-[#F5F5DC] to-transparent dark:from-[#0f1510]" />

        <div className="trustbar-marquee flex w-max items-center">
          {items.map((item, i) => renderItem(item, i))}
          {items.map((item, i) => renderItem(item, i + items.length))}
        </div>
      </div>
    </section>
  );
}
