"use client";

import { AppBurgerHeader } from "@/components/ui/app-burger-header";
import { LearnLogo } from "@/components/ui/learn-logo";
import { EmailCampaignsComposer } from "@/components/email/email-campaigns-composer";
import { adminHubNavItems } from "@/lib/nav/burger-nav";
import { useI18n } from "@/lib/i18n/context";

export default function AdminEmailCampaignsPage() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-slate-950">
      <AppBurgerHeader
        logoHref="/"
        logo={<LearnLogo size="md" variant="purple" />}
        items={adminHubNavItems(t)}
        borderClassName="border-b border-slate-700/50"
        className="bg-slate-900/90 backdrop-blur-sm"
      />
      <EmailCampaignsComposer apiPrefix="/admin/email-campaigns" scope="platform" />
    </div>
  );
}
