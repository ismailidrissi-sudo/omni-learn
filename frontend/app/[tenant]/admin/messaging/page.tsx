"use client";

import { useParams } from "next/navigation";
import { useTenant } from "@/components/providers/tenant-context";
import { TenantAdminBurgerHeader } from "@/components/ui/tenant-admin-burger-header";
import { EmailCampaignsComposer } from "@/components/email/email-campaigns-composer";

export default function TenantAdminMessagingPage() {
  const params = useParams();
  const slug = typeof params.tenant === "string" ? params.tenant : "";
  const { tenant, branding, isLoading } = useTenant();
  const academyName = branding?.appName || tenant?.name || "Academy";

  if (isLoading || !slug) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <TenantAdminBurgerHeader
        slug={slug}
        academyName={academyName}
        logoUrl={tenant?.logoUrl}
        className="bg-slate-900/90 backdrop-blur-sm"
        borderClassName="border-b border-slate-700/50"
      />
      <EmailCampaignsComposer apiPrefix="/company-admin/email-campaigns" scope="tenant" />
    </div>
  );
}
