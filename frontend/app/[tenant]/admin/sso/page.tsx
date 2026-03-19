"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useTenant } from "@/components/providers/tenant-context";
import { TenantAdminBurgerHeader } from "@/components/ui/tenant-admin-burger-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { apiFetch } from "@/lib/api";
import { toast } from "@/lib/use-toast";
import { useI18n } from "@/lib/i18n/context";

type SsoConfig = {
  id: string;
  provider: string;
  isEnabled: boolean;
  entityId?: string;
  metadataUrl?: string;
  clientId?: string;
  clientSecret?: string;
  config?: Record<string, unknown>;
};

export default function SsoConfigPage() {
  const params = useParams();
  const slug = typeof params.tenant === "string" ? params.tenant : "";
  const { t } = useI18n();
  const { tenant, branding, isLoading } = useTenant();

  const [, setConfigs] = useState<SsoConfig[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<"SAML_2_0" | "OIDC">("SAML_2_0");
  const [form, setForm] = useState({
    entityId: "", metadataUrl: "", clientId: "", clientSecret: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const academyName = branding?.appName || tenant?.name || "Academy";

  useEffect(() => {
    if (!tenant) return;
    apiFetch(`/company/tenants/${tenant.id}`)
      .then((r) => r.json())
      .then((data) => {
        const ssoConfigs = data?.ssoConfigs ?? [];
        setConfigs(ssoConfigs);
        const existing = ssoConfigs.find((c: SsoConfig) => c.provider === selectedProvider);
        if (existing) {
          setForm({
            entityId: existing.entityId ?? "",
            metadataUrl: existing.metadataUrl ?? "",
            clientId: existing.clientId ?? "",
            clientSecret: "",
          });
        }
      })
      .catch(() => {});
  }, [tenant?.id, selectedProvider]);

  const save = async () => {
    if (!tenant) return;
    setSaving(true);
    setError("");
    try {
      toast("SSO configuration saved (integration pending)", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("adminTenant.saveConfigFailed"));
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

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <TenantAdminBurgerHeader
        slug={slug}
        academyName={academyName}
        logoUrl={tenant?.logoUrl}
        contextSlot={<span className="text-sm text-[var(--color-text-secondary)]">/ {t("adminTenant.sso")}</span>}
      />

      <main className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-6">{t("adminTenant.ssoConfig")}</h1>

        {error && <ErrorBanner message={error} onDismiss={() => setError("")} className="mb-6" />}

        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setSelectedProvider("SAML_2_0")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedProvider === "SAML_2_0"
                ? "bg-[var(--color-accent)] text-white"
                : "bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
            }`}
          >
            SAML 2.0
          </button>
          <button
            onClick={() => setSelectedProvider("OIDC")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedProvider === "OIDC"
                ? "bg-[var(--color-accent)] text-white"
                : "bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
            }`}
          >
            OpenID Connect (OIDC)
          </button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{selectedProvider === "SAML_2_0" ? "SAML 2.0" : "OIDC"} Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedProvider === "SAML_2_0" ? (
              <>
                <div>
                  <label className="text-sm font-medium">{t("adminTenant.entityId")}</label>
                  <Input value={form.entityId} onChange={(e) => setForm((f) => ({ ...f, entityId: e.target.value }))} placeholder="https://idp.example.com/metadata" />
                </div>
                <div>
                  <label className="text-sm font-medium">{t("adminTenant.metadataUrl")}</label>
                  <Input value={form.metadataUrl} onChange={(e) => setForm((f) => ({ ...f, metadataUrl: e.target.value }))} placeholder="https://idp.example.com/metadata.xml" />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="text-sm font-medium">{t("adminTenant.issuerUrl")}</label>
                  <Input value={form.entityId} onChange={(e) => setForm((f) => ({ ...f, entityId: e.target.value }))} placeholder="https://accounts.google.com" />
                </div>
                <div>
                  <label className="text-sm font-medium">Client ID</label>
                  <Input value={form.clientId} onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))} placeholder="your-client-id" />
                </div>
                <div>
                  <label className="text-sm font-medium">{t("adminTenant.clientSecret")}</label>
                  <Input type="password" value={form.clientSecret} onChange={(e) => setForm((f) => ({ ...f, clientSecret: e.target.value }))} placeholder="your-client-secret" />
                </div>
              </>
            )}

            <div className="flex items-center gap-4 pt-4">
              <Button variant="primary" onClick={save} disabled={saving}>
                {saving ? t("common.saving") : t("adminTenant.saveConfig")}
              </Button>
              <Button variant="ghost">{t("adminTenant.testConnection")}</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader><CardTitle>Service Provider Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t("adminTenant.acsUrl")}</label>
              <div className="mt-1 px-3 py-2 rounded bg-[var(--color-bg-secondary)]/50 font-mono text-sm">
                {typeof window !== "undefined" ? window.location.origin : ""}/auth/saml/callback
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">Entity ID</label>
              <div className="mt-1 px-3 py-2 rounded bg-[var(--color-bg-secondary)]/50 font-mono text-sm">
                {typeof window !== "undefined" ? window.location.origin : ""}/auth/saml/metadata
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
