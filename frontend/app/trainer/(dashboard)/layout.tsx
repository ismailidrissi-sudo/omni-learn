"use client";

import { LearnLogo } from "@/components/ui/learn-logo";
import { AppBurgerHeader } from "@/components/ui/app-burger-header";
import { TrainerTabNav } from "@/components/trainer/trainer-tab-nav";
import { trainerNavItemsApproved, trainerNavItemsGuest } from "@/lib/nav/burger-nav";
import { useI18n } from "@/lib/i18n/context";
import { useUser } from "@/lib/use-user";
import { useMemo } from "react";

export default function TrainerDashboardLayout({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const { user, loading } = useUser();
  const approved = !!user?.isAdmin || !!user?.trainerApprovedAt;
  const trainerNavApproved = useMemo(() => trainerNavItemsApproved(t), [t]);
  const trainerNavGuest = useMemo(() => trainerNavItemsGuest(t), [t]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#6B7280]">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="font-[family-name:var(--font-trainer)] text-[#1A1A1A]">
      <AppBurgerHeader
        logoHref="/"
        logo={<LearnLogo size="md" variant="purple" />}
        items={approved ? trainerNavApproved : trainerNavGuest}
      />
      {approved && <TrainerTabNav />}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-10">{children}</div>
    </div>
  );
}
