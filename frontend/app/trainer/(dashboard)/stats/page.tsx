"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/context";
import { apiFetch } from "@/lib/api";
import { useUser } from "@/lib/use-user";

export default function TrainerStatsPage() {
  const { t } = useI18n();
  const { user, loading: userLoading } = useUser();
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  const approved = !!user?.isAdmin || !!user?.trainerApprovedAt;

  useEffect(() => {
    if (!approved) {
      setLoading(false);
      return;
    }
    setLoading(true);
    apiFetch("/trainer-profiles/me/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [approved]);

  if (userLoading || !user) {
    return <p className="py-10 text-[#6B7280]">{t("common.loading")}</p>;
  }

  if (!approved) {
    return (
      <Card className="p-8 mt-6 border border-black/[0.08] rounded-xl shadow-none">
        <p className="text-[#6B7280]">{t("trainer.statsTrainerOnly")}</p>
      </Card>
    );
  }

  if (loading) {
    return <p className="py-10 text-[#6B7280]">{t("common.loading")}</p>;
  }

  return (
    <main className="py-6 space-y-6">
      <h1 className="text-xl font-bold text-[#1A1A1A]">{t("trainer.stats.title")}</h1>
      <p className="text-sm text-[#6B7280]">{t("trainer.stats.subtitle")}</p>
      {stats && typeof stats === "object" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(stats).map(([k, v]) => (
            <Card key={k} className="p-4 border border-black/[0.08] rounded-xl shadow-none">
              <p className="text-xs text-[#9CA3AF] uppercase tracking-wide">{k}</p>
              <p className="text-lg font-semibold text-[#1A1A1A] mt-1">{String(v)}</p>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 border border-black/[0.08] rounded-xl shadow-none text-[#6B7280]">
          {t("trainer.stats.empty")}
        </Card>
      )}
    </main>
  );
}
