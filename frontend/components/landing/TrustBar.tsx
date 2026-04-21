"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { apiFetch, apiAbsoluteMediaUrl } from "@/lib/api";
import { formatUserCount } from "@/lib/format-user-count";
import { normalizeTrustedCompanyName } from "@/lib/trusted-company-name";

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
  const dedupedCompanies = (() => {
    const seenNames = new Set<string>();
    const seenLogoKeys = new Set<string>();
    const out: TrustedCompany[] = [];
    for (const c of companies) {
      if (!c.logoUrl?.trim()) continue;
      const norm = normalizeTrustedCompanyName(c.name);
      const nameKey = norm.length > 0 ? norm : `id:${c.id}`;
      const rawUrl = c.logoUrl.split("?")[0] ?? "";
      const logoKey = rawUrl.toLowerCase();
      if (seenNames.has(nameKey)) continue;
      if (logoKey && seenLogoKeys.has(logoKey)) continue;
      seenNames.add(nameKey);
      if (logoKey) seenLogoKeys.add(logoKey);
      out.push(c);
    }
    return out;
  })();
  const items = dedupedCompanies;
  const visibleItems = items.filter((c) => !brokenLogos.has(c.id));

  const userCount = stats?.userCount ?? 0;
  const displayCount = userCount > 0 ? formatUserCount(userCount) : "2,000,000+";

  if (!loading && visibleItems.length === 0) return null;

  return (
    <section className="border-y border-[#D4B896]/30 dark:border-[#D4B896]/10 py-6 md:py-8">
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

      <div className="relative px-4">
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5 md:gap-x-14 md:gap-y-6">
          {visibleItems.map((item) => (
            <div
              key={item.id}
              className="flex h-14 shrink-0 items-center justify-center md:h-16"
            >
              <img
                src={apiAbsoluteMediaUrl(item.logoUrl) ?? item.logoUrl}
                alt={item.name}
                title={item.name}
                className="h-10 w-auto max-w-[120px] object-contain object-center mix-blend-multiply dark:mix-blend-normal dark:brightness-0 dark:invert dark:opacity-80 md:h-12 md:max-w-[150px]"
                loading="lazy"
                onError={() => handleImgError(item.id)}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
