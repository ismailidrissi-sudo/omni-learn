"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useTenant } from "@/components/providers/tenant-context";
import { TenantAdminBurgerHeader } from "@/components/ui/tenant-admin-burger-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { toast } from "@/lib/use-toast";
import { useI18n } from "@/lib/i18n/context";

type BrandingForm = {
  appName: string;
  tagline: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  loginBgUrl: string;
  fontFamily: string;
  navStyle: string;
  customCss: string;
};

export default function BrandingStudioPage() {
  const params = useParams();
  const slug = typeof params.tenant === "string" ? params.tenant : "";
  const { t } = useI18n();
  const { tenant, branding, isLoading } = useTenant();

  const [form, setForm] = useState<BrandingForm>({
    appName: "", tagline: "", logoUrl: "", faviconUrl: "",
    primaryColor: "#059669", secondaryColor: "#D4B896", accentColor: "",
    loginBgUrl: "", fontFamily: "", navStyle: "topbar", customCss: "",
  });
  const [saving, setSaving] = useState(false);

  const academyName = branding?.appName || tenant?.name || "Academy";

  useEffect(() => {
    if (!branding) return;
    setForm({
      appName: branding.appName ?? "",
      tagline: branding.tagline ?? "",
      logoUrl: branding.logoUrl ?? "",
      faviconUrl: branding.faviconUrl ?? "",
      primaryColor: branding.primaryColor ?? "#059669",
      secondaryColor: branding.secondaryColor ?? "#D4B896",
      accentColor: branding.accentColor ?? "",
      loginBgUrl: branding.loginBgUrl ?? "",
      fontFamily: branding.fontFamily ?? "",
      navStyle: branding.navStyle ?? "topbar",
      customCss: branding.customCss ?? "",
    });
  }, [branding]);

  const update = (key: keyof BrandingForm, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const save = async () => {
    if (!tenant) return;
    setSaving(true);
    try {
      await apiFetch(`/company/tenants/${tenant.id}/branding`, {
        method: "PUT",
        body: JSON.stringify(form),
      });
      toast(t("adminTenant.brandingSaved"), "success");
    } catch {
      toast(t("adminTenant.brandingSaveFailed"), "error");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
        <div className="h-10 w-10 rounded-full border-4 border-[var(--color-accent)] border-t-transparent animate-spin" />
      </div>
    );
  }

  const previewPrimary = form.primaryColor || "#059669";

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <TenantAdminBurgerHeader
        slug={slug}
        academyName={academyName}
        logoUrl={tenant?.logoUrl}
        contextSlot={
          <span className="text-sm text-[var(--color-text-secondary)]">/ {t("adminTenant.branding")}</span>
        }
      />

      <main className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{t("adminTenant.brandingStudio")}</h1>
          <Button variant="primary" onClick={save} disabled={saving}>
            {saving ? t("common.saving") : t("adminTenant.saveBranding")}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>{t("adminTenant.identity")}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">{t("adminTenant.academyName")}</label>
                  <Input value={form.appName} onChange={(e) => update("appName", e.target.value)} placeholder={t("adminTenant.myCompanyAcademy")} />
                </div>
                <div>
                  <label className="text-sm font-medium">{t("adminTenant.tagline")}</label>
                  <Input value={form.tagline} onChange={(e) => update("tagline", e.target.value)} placeholder={t("adminTenant.enterpriseLearningPlatform")} />
                </div>
                <div>
                  <label className="text-sm font-medium">{t("adminTenant.logoUrl")}</label>
                  <Input value={form.logoUrl} onChange={(e) => update("logoUrl", e.target.value)} placeholder="https://..." />
                </div>
                <div>
                  <label className="text-sm font-medium">{t("adminTenant.faviconUrl")}</label>
                  <Input value={form.faviconUrl} onChange={(e) => update("faviconUrl", e.target.value)} placeholder="https://..." />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>{t("adminTenant.colors")}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium">{t("adminTenant.primary")}</label>
                    <div className="flex items-center gap-2 mt-1">
                      <input type="color" value={form.primaryColor} onChange={(e) => update("primaryColor", e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0" />
                      <Input value={form.primaryColor} onChange={(e) => update("primaryColor", e.target.value)} className="flex-1" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t("adminTenant.secondary")}</label>
                    <div className="flex items-center gap-2 mt-1">
                      <input type="color" value={form.secondaryColor} onChange={(e) => update("secondaryColor", e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0" />
                      <Input value={form.secondaryColor} onChange={(e) => update("secondaryColor", e.target.value)} className="flex-1" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t("adminTenant.accent")}</label>
                    <div className="flex items-center gap-2 mt-1">
                      <input type="color" value={form.accentColor || form.primaryColor} onChange={(e) => update("accentColor", e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0" />
                      <Input value={form.accentColor} onChange={(e) => update("accentColor", e.target.value)} className="flex-1" placeholder={t("adminTenant.sameAsPrimary")} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>{t("adminTenant.advanced")}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">{t("adminTenant.loginBgUrl")}</label>
                  <Input value={form.loginBgUrl} onChange={(e) => update("loginBgUrl", e.target.value)} placeholder="https://..." />
                </div>
                <div>
                  <label className="text-sm font-medium">{t("adminTenant.fontFamily")}</label>
                  <Input value={form.fontFamily} onChange={(e) => update("fontFamily", e.target.value)} placeholder="Inter, sans-serif" />
                </div>
                <div>
                  <label className="text-sm font-medium">{t("adminTenant.navStyle")}</label>
                  <select
                    value={form.navStyle}
                    onChange={(e) => update("navStyle", e.target.value)}
                    className="w-full mt-1 rounded-lg border border-[var(--color-bg-secondary)] bg-white dark:bg-[#1a1e18] px-3 py-2"
                  >
                    <option value="topbar">{t("adminTenant.topNavOption")}</option>
                    <option value="sidebar">{t("adminTenant.sideNavOption")}</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">{t("adminTenant.customCss")}</label>
                  <textarea
                    value={form.customCss}
                    onChange={(e) => update("customCss", e.target.value)}
                    placeholder=":root { --custom-var: #fff; }"
                    rows={4}
                    className="w-full mt-1 rounded-lg border border-[var(--color-bg-secondary)] bg-white dark:bg-[#1a1e18] px-3 py-2 font-mono text-sm"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>{t("adminTenant.livePreview")}</CardTitle></CardHeader>
              <CardContent>
                <div className="rounded-xl border border-[var(--color-bg-secondary)] overflow-hidden">
                  <div className="px-4 py-3 flex items-center gap-3 border-b border-gray-200" style={{ backgroundColor: previewPrimary + "10" }}>
                    {form.logoUrl ? (
                      <img src={form.logoUrl} alt="Logo" className="h-8 w-8 object-contain rounded" />
                    ) : (
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: previewPrimary }}>
                        {(form.appName || tenant?.name || "A").charAt(0)}
                      </div>
                    )}
                    <span className="font-semibold text-sm">{form.appName || tenant?.name || "Academy"}</span>
                  </div>
                  <div className="p-6 bg-white dark:bg-[#1a1e18]">
                    <h3 className="text-lg font-bold mb-2" style={{ color: previewPrimary }}>
                      {t("adminTenant.welcomeTo", { name: form.appName || t("adminTenant.myCompanyAcademy") })}
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">{form.tagline || t("adminTenant.enterpriseLearningPlatform")}</p>
                    <button className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: previewPrimary }}>
                      {t("adminTenant.getStarted")}
                    </button>
                  </div>
                </div>

                <div className="mt-6 rounded-xl border border-[var(--color-bg-secondary)] overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 dark:bg-[#1a1e18]">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">{t("adminTenant.signInPreview")}</span>
                  </div>
                  <div className="p-6 bg-white dark:bg-[#1a1e18]"
                    style={form.loginBgUrl ? {
                      backgroundImage: `url(${form.loginBgUrl})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    } : undefined}
                  >
                    <div className="bg-white/90 dark:bg-[#1a1e18]/90 rounded-xl p-4">
                      <p className="text-sm font-semibold mb-2">{t("adminTenant.signInTo", { name: form.appName || t("adminTenant.academy") })}</p>
                      <div className="h-8 rounded bg-gray-100 dark:bg-gray-800 mb-2" />
                      <div className="h-8 rounded bg-gray-100 dark:bg-gray-800 mb-3" />
                      <div className="h-8 rounded text-white text-xs flex items-center justify-center font-medium" style={{ backgroundColor: previewPrimary }}>
                        {t("auth.signIn")}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
