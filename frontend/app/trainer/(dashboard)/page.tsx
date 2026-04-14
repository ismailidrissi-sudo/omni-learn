"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrainerProfileEditor } from "@/components/trainer/trainer-profile-editor";
import { apiFetch } from "@/lib/api";
import { useUser } from "@/lib/use-user";
import { useI18n } from "@/lib/i18n/context";

export default function TrainerDashboardHomePage() {
  const { t } = useI18n();
  const { user, loading: userLoading } = useUser();
  const [error, setError] = useState("");
  const [requestingTrainer, setRequestingTrainer] = useState(false);

  const isApprovedTrainer = !!user?.isAdmin || !!user?.trainerApprovedAt;
  const trainerPending =
    !user?.isAdmin && !!user?.trainerRequested && !user?.trainerApprovedAt;

  const handleRequestTrainer = () => {
    setRequestingTrainer(true);
    apiFetch("/profile/request-trainer", { method: "POST" })
      .then((r) => r.json())
      .then(() => window.location.reload())
      .catch(() => setError(t("trainer.requestFailed")))
      .finally(() => setRequestingTrainer(false));
  };

  if (userLoading || !user) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-[#6B7280]">
        {t("common.loading")}
      </div>
    );
  }

  if (!isApprovedTrainer) {
    return (
      <main className="max-w-xl mx-auto py-10">
        <Card className="p-8 text-center border border-black/[0.08] rounded-xl shadow-none">
          {trainerPending ? (
            <>
              <h1 className="text-xl font-semibold text-[#1A1A1A] mb-2">{t("trainer.requestPendingTitle")}</h1>
              <p className="text-[#6B7280] text-sm">{t("trainer.requestPendingBody")}</p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-[#1A1A1A] mb-2">{t("trainer.requestAccessTitle")}</h1>
              <p className="text-[#6B7280] text-sm mb-6">{t("trainer.requestAccessBody")}</p>
              {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
              <Button
                className="bg-[#1D9E75] hover:bg-[#178f68] text-white"
                onClick={handleRequestTrainer}
                disabled={requestingTrainer}
              >
                {requestingTrainer ? t("common.loading") : t("trainer.requestAccessCta")}
              </Button>
            </>
          )}
        </Card>
      </main>
    );
  }

  return <TrainerProfileEditor />;
}
