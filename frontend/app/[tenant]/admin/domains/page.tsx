"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTenant } from "@/components/providers/tenant-context";
import { TenantAdminBurgerHeader } from "@/components/ui/tenant-admin-burger-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner } from "@/components/ui/error-banner";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n/context";
import { toast } from "@/lib/use-toast";

interface Domain {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  color: string;
  isActive: boolean;
  sortOrder: number;
  _count?: { learningPaths: number; contentItems: number };
}

interface DomainForm {
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  sortOrder: number;
}

const EMPTY_FORM: DomainForm = { name: "", slug: "", description: "", icon: "📚", color: "#059669", sortOrder: 0 };

function slugify(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function TenantDomainsAdminPage() {
  const params = useParams();
  const slug = typeof params.tenant === "string" ? params.tenant : "";
  const { t } = useI18n();
  const { tenant, branding, isLoading } = useTenant();

  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<DomainForm>(EMPTY_FORM);
  const [autoSlug, setAutoSlug] = useState(true);
  const [saving, setSaving] = useState(false);

  const academyName = branding?.appName || tenant?.name || "Academy";

  const loadDomains = useCallback(() => {
    if (!tenant?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    apiFetch(`/domains?tenantId=${tenant.id}&activeOnly=false`)
      .then((r) => r.json())
      .then((d: Domain[]) => setDomains(Array.isArray(d) ? d : []))
      .catch(() => setError(t("adminTenant.domainLoadFailed")))
      .finally(() => setLoading(false));
  }, [tenant?.id, t]);

  useEffect(() => { loadDomains(); }, [loadDomains]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setAutoSlug(true);
    setEditId(null);
    setView("create");
    setError("");
  }

  function openEdit(d: Domain) {
    setForm({
      name: d.name,
      slug: d.slug,
      description: d.description || "",
      icon: d.icon || "📚",
      color: d.color,
      sortOrder: d.sortOrder,
    });
    setAutoSlug(false);
    setEditId(d.id);
    setView("edit");
    setError("");
  }

  function updateField(key: keyof DomainForm, value: string | number) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === "name" && autoSlug) next.slug = slugify(value as string);
      return next;
    });
  }

  async function handleSave() {
    if (!form.name.trim()) { setError(t("adminTenant.domainNameRequired")); return; }
    if (!tenant?.id) { setError("Tenant context not available. Please refresh and try again."); return; }
    setSaving(true);
    setError("");
    try {
      const url = editId ? `/domains/${editId}` : "/domains";
      const method = editId ? "PUT" : "POST";
      const body = editId
        ? { name: form.name, slug: form.slug, description: form.description || undefined, icon: form.icon, color: form.color, sortOrder: form.sortOrder }
        : { tenantId: tenant.id, name: form.name, slug: form.slug || undefined, description: form.description || undefined, icon: form.icon, color: form.color };
      const res = await apiFetch(url, { method, body: JSON.stringify(body) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message || t("adminTenant.domainSaveFailed"));
        return;
      }
      toast(editId ? t("adminTenant.domainUpdated") : t("adminTenant.domainCreated"), "success");
      setView("list");
      loadDomains();
    } catch {
      setError(t("adminTenant.domainSaveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(d: Domain) {
    try {
      const res = await apiFetch(`/domains/${d.id}/toggle`, {
        method: "PUT",
        body: JSON.stringify({ active: !d.isActive }),
      });
      if (res.ok) loadDomains();
    } catch { /* ignore */ }
  }

  async function deleteDomain(d: Domain) {
    if (!confirm(t("adminTenant.domainDeleteConfirm", { name: d.name }))) return;
    try {
      const res = await apiFetch(`/domains/${d.id}`, { method: "DELETE" });
      if (res.ok) {
        toast(t("adminTenant.domainDeleted", { name: d.name }), "success");
        loadDomains();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data?.message || t("adminTenant.domainDeleteFailed"));
      }
    } catch {
      setError(t("adminTenant.domainDeleteFailed"));
    }
  }

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
        contextSlot={<span className="text-sm text-[var(--color-text-secondary)]">/ {t("adminTenant.domains")}</span>}
      />

      <main className="max-w-5xl mx-auto p-6">
        {error && <ErrorBanner message={error} onDismiss={() => setError("")} className="mb-4" />}

        {view === "list" ? (
          <>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {t("adminTenant.learningDomains")}
                </h1>
                <p className="text-[var(--color-text-secondary)] text-sm mt-1">
                  {t("adminTenant.domainDescription")}
                </p>
              </div>
              <Button onClick={openCreate}>+ {t("adminTenant.newDomain")}</Button>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="p-5 animate-pulse">
                    <div className="h-5 bg-[var(--color-bg-secondary)] rounded w-1/3 mb-2" />
                    <div className="h-4 bg-[var(--color-bg-secondary)] rounded w-1/5" />
                  </Card>
                ))}
              </div>
            ) : domains.length === 0 ? (
              <Card className="p-12 text-center">
                <div className="text-4xl mb-4">🗂️</div>
                <p className="font-medium text-[var(--color-text-primary)]">{t("adminTenant.noDomainsYet")}</p>
                <p className="text-sm mt-1 text-[var(--color-text-secondary)]">{t("adminTenant.domainCreateHint")}</p>
                <Button className="mt-4" onClick={openCreate}>{t("adminTenant.createDomain")}</Button>
              </Card>
            ) : (
              <div className="space-y-3">
                {domains.map((d) => (
                  <Card key={d.id} className="p-0 overflow-hidden">
                    <div className="flex items-stretch">
                      <div className="w-1.5 flex-shrink-0" style={{ backgroundColor: d.color }} />
                      <div className="flex-1 p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <span className="text-2xl flex-shrink-0">{d.icon || "📚"}</span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-[var(--color-text-primary)] truncate">{d.name}</h3>
                              {!d.isActive && <Badge variant="stardust">{t("adminTenant.inactive")}</Badge>}
                            </div>
                            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                              /{d.slug}
                              {d._count && (
                                <span className="ml-3">
                                  {d._count.learningPaths} {t("adminTenant.domainPaths")}
                                  {" · "}
                                  {d._count.contentItems} {t("adminTenant.domainItems")}
                                </span>
                              )}
                            </p>
                            {d.description && (
                              <p className="text-xs text-[var(--color-text-secondary)] mt-1 truncate max-w-md">{d.description}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="w-5 h-5 rounded-full border border-[var(--color-bg-secondary)]" style={{ backgroundColor: d.color }} title={d.color} />
                          <Button variant="ghost" size="sm" onClick={() => toggleActive(d)}>
                            {d.isActive ? t("adminTenant.disable") : t("adminTenant.enable")}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openEdit(d)}>
                            {t("common.edit")}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteDomain(d)} className="text-red-500 hover:text-red-600">
                            {t("common.delete")}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : (
          /* ── CREATE / EDIT FORM ── */
          <div>
            <button
              type="button"
              onClick={() => { setView("list"); setError(""); }}
              className="flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors mb-4"
            >
              &larr; {t("adminTenant.backToDomains")}
            </button>

            <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-6">
              {view === "create" ? t("adminTenant.newDomain") : t("adminTenant.editDomain", { name: form.name })}
            </h1>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader><CardTitle>{t("adminTenant.domainIdentity")}</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <Input
                      label={t("adminTenant.domainName") + " *"}
                      value={form.name}
                      onChange={(e) => updateField("name", e.target.value)}
                      placeholder={t("adminTenant.domainNamePlaceholder")}
                    />
                    <Input
                      label={t("adminTenant.domainSlug")}
                      value={form.slug}
                      onChange={(e) => { setAutoSlug(false); updateField("slug", e.target.value); }}
                      placeholder={t("adminTenant.domainSlugHint")}
                      hint={t("adminTenant.domainSlugHint")}
                    />
                    <Input
                      label={t("adminTenant.domainDesc")}
                      value={form.description}
                      onChange={(e) => updateField("description", e.target.value)}
                      placeholder={t("adminTenant.domainDescPlaceholder")}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>{t("adminTenant.domainAppearance")}</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">{t("adminTenant.domainIcon")}</label>
                        <Input
                          value={form.icon}
                          onChange={(e) => updateField("icon", e.target.value)}
                          placeholder="📚"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">{t("adminTenant.domainColor")}</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={form.color}
                            onChange={(e) => updateField("color", e.target.value)}
                            className="w-10 h-10 rounded-lg border border-[var(--color-bg-secondary)] cursor-pointer"
                          />
                          <Input value={form.color} onChange={(e) => updateField("color", e.target.value)} className="flex-1" />
                        </div>
                      </div>
                    </div>
                    {view === "edit" && (
                      <div>
                        <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">{t("adminTenant.domainSortOrder")}</label>
                        <Input
                          type="number"
                          value={String(form.sortOrder)}
                          onChange={(e) => updateField("sortOrder", parseInt(e.target.value) || 0)}
                          hint={t("adminTenant.domainSortHint")}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Preview */}
              <div className="lg:col-span-1">
                <div className="sticky top-6 space-y-4">
                  <Card className="p-0 overflow-hidden">
                    <CardHeader className="bg-[var(--color-bg-secondary)]/40 border-b border-[var(--color-bg-secondary)]">
                      <CardTitle className="text-sm">{t("adminTenant.livePreview")}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3 mb-4">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                          style={{ backgroundColor: form.color + "20" }}
                        >
                          {form.icon || "📚"}
                        </div>
                        <div>
                          <h4 className="font-semibold text-[var(--color-text-primary)]">{form.name || t("adminTenant.domainName")}</h4>
                          <p className="text-xs text-[var(--color-text-secondary)]">/{form.slug || "slug"}</p>
                        </div>
                      </div>
                      {form.description && (
                        <p className="text-sm text-[var(--color-text-secondary)] mb-3">{form.description}</p>
                      )}
                      <div className="w-full h-2 rounded-full" style={{ backgroundColor: form.color }} />
                      <p className="text-xs text-[var(--color-text-secondary)] mt-3">
                        {view === "create" ? t("adminTenant.certWillBeCreated") : t("adminTenant.certAssociated")}
                      </p>
                    </CardContent>
                  </Card>

                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setView("list")} className="flex-1">
                      {t("common.cancel")}
                    </Button>
                    <Button onClick={handleSave} disabled={saving} className="flex-1">
                      {saving ? t("common.saving") : view === "create" ? t("adminTenant.createDomain") : t("adminTenant.saveDomain")}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
