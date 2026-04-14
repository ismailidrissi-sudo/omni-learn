"use client";

import { Card } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/context";
import { useUser } from "@/lib/use-user";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function TrainerSettingsPage() {
  const { t } = useI18n();
  const { user, loading } = useUser();
  const approved = !!user?.isAdmin || !!user?.trainerApprovedAt;

  if (loading || !user) {
    return <p className="py-10 text-[#6B7280]">{t("common.loading")}</p>;
  }

  if (!approved) {
    return (
      <Card className="p-8 mt-6 border border-black/[0.08] rounded-xl shadow-none">
        <p className="text-[#6B7280]">{t("trainer.settingsTrainerOnly")}</p>
      </Card>
    );
  }

  return (
    <main className="py-6 space-y-4">
      <h1 className="text-xl font-bold text-[#1A1A1A]">{t("trainer.settings.title")}</h1>
      <p className="text-sm text-[#6B7280]">{t("trainer.settings.subtitle")}</p>
      <Card className="p-6 border border-black/[0.08] rounded-xl shadow-none max-w-lg">
        <p className="text-sm text-[#6B7280] mb-4">{t("trainer.settings.publishHint")}</p>
        <Link href="/trainer">
          <Button variant="outline" className="border-[#1D9E75] text-[#1D9E75]">
            {t("trainer.settings.backToProfile")}
          </Button>
        </Link>
      </Card>
    </main>
  );
}
