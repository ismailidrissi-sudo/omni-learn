"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTenant } from "@/components/providers/tenant-context";
import { TenantLogo } from "@/components/ui/tenant-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NavToggles } from "@/components/ui/nav-toggles";
import { ErrorBanner } from "@/components/ui/error-banner";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n/context";

interface ThemeConfig {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  seal_text: string;
  title_font: string;
  body_font: string;
}

interface ElementsConfig {
  show_logo: boolean;
  show_qr: boolean;
  show_hours: boolean;
  show_grade: boolean;
  show_signature: boolean;
  show_seal: boolean;
  show_expiry: boolean;
  show_badge: boolean;
}

interface Signatory {
  name: string;
  title: string;
}

interface CertTemplate {
  id: string;
  templateName: string;
  themeConfig: string | ThemeConfig;
  elementsConfig: string | ElementsConfig;
  signatories: string | Signatory[];
  domain?: { id: string; name: string; slug: string; color: string; icon?: string };
}

function parseJson<T>(val: string | T, fallback: T): T {
  if (typeof val === "string") {
    try { return JSON.parse(val); } catch { return fallback; }
  }
  return val ?? fallback;
}

const ELEMENT_LABELS: Record<keyof ElementsConfig, string> = {
  show_logo: "Company Logo",
  show_qr: "QR Verification Code",
  show_hours: "Learning Hours",
  show_grade: "Grade",
  show_signature: "Signatures",
  show_seal: "Certification Seal",
  show_expiry: "Expiry Date",
  show_badge: "Digital Badge",
};

const FONT_OPTIONS = [
  "Playfair Display",
  "Source Serif 4",
  "Inter",
  "Roboto",
  "Montserrat",
  "Lora",
  "Merriweather",
  "Georgia",
];

const DEFAULT_THEME: ThemeConfig = {
  primary_color: "#059669",
  secondary_color: "#10b981",
  accent_color: "#c8a951",
  seal_text: "CERTIFIED PROFESSIONAL",
  title_font: "Playfair Display",
  body_font: "Source Serif 4",
};

const DEFAULT_ELEMENTS: ElementsConfig = {
  show_logo: true,
  show_qr: true,
  show_hours: true,
  show_grade: true,
  show_signature: true,
  show_seal: true,
  show_expiry: false,
  show_badge: false,
};

export default function TenantCertificatesAdminPage() {
  const params = useParams();
  const slug = typeof params.tenant === "string" ? params.tenant : "";
  const { t } = useI18n();
  const { tenant, branding, isLoading } = useTenant();

  const [templates, setTemplates] = useState<CertTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [editName, setEditName] = useState("");
  const [editTheme, setEditTheme] = useState<ThemeConfig>(DEFAULT_THEME);
  const [editElements, setEditElements] = useState<ElementsConfig>(DEFAULT_ELEMENTS);
  const [editSignatories, setEditSignatories] = useState<Signatory[]>([]);
  const [saving, setSaving] = useState(false);

  const academyName = branding?.appName || tenant?.name || "Academy";

  const loadTemplates = useCallback(() => {
    if (!tenant?.id) return;
    setLoading(true);
    apiFetch(`/certificates/templates/all?tenantId=${tenant.id}`)
      .then((r) => r.json())
      .then((data: CertTemplate[]) => setTemplates(Array.isArray(data) ? data : []))
      .catch(() => setError(t("adminTenant.certLoadFailed")))
      .finally(() => setLoading(false));
  }, [tenant?.id, t]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  function startEdit(tpl: CertTemplate) {
    setEditingId(tpl.id);
    setEditName(tpl.templateName);
    setEditTheme(parseJson<ThemeConfig>(tpl.themeConfig, DEFAULT_THEME));
    setEditElements(parseJson<ElementsConfig>(tpl.elementsConfig, DEFAULT_ELEMENTS));
    setEditSignatories(parseJson<Signatory[]>(tpl.signatories, []));
    setError("");
    setSuccess("");
  }

  function cancelEdit() {
    setEditingId(null);
    setError("");
    setSuccess("");
  }

  async function saveTemplate() {
    if (!editingId) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await apiFetch(`/certificates/templates/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify({
          templateName: editName,
          themeConfig: editTheme,
          elementsConfig: editElements,
          signatories: editSignatories,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message || t("adminTenant.certSaveFailed"));
        return;
      }
      setSuccess(t("adminTenant.certSaved"));
      setEditingId(null);
      loadTemplates();
    } catch {
      setError(t("adminTenant.certSaveFailed"));
    } finally {
      setSaving(false);
    }
  }

  function addSignatory() {
    setEditSignatories([...editSignatories, { name: "", title: "" }]);
  }

  function removeSignatory(idx: number) {
    setEditSignatories(editSignatories.filter((_, i) => i !== idx));
  }

  function updateSignatory(idx: number, field: keyof Signatory, value: string) {
    setEditSignatories(editSignatories.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  }

  const editingTpl = templates.find((tpl) => tpl.id === editingId);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
        <div className="h-10 w-10 rounded-full border-4 border-[var(--color-accent)] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <header className="border-b border-[var(--color-bg-secondary)] px-6 py-4 flex justify-between items-center">
        <Link href={`/${slug}/admin`} className="flex items-center gap-3">
          <TenantLogo logoUrl={tenant?.logoUrl} name={academyName} size="md" />
          <span className="text-lg font-bold text-[var(--color-text-primary)]">{academyName}</span>
          <span className="text-sm text-[var(--color-text-secondary)]">/ {t("adminTenant.certificates")}</span>
        </Link>
        <NavToggles />
      </header>

      <main className="max-w-5xl mx-auto p-6">
        {error && <ErrorBanner message={error} onDismiss={() => setError("")} className="mb-4" />}
        {success && <ErrorBanner message={success} variant="success" onDismiss={() => setSuccess("")} className="mb-4" />}

        {!editingId ? (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
                {t("adminTenant.certificateTemplates")}
              </h1>
              <p className="text-[var(--color-text-secondary)] text-sm mt-1">
                {t("adminTenant.certDescription")}
              </p>
            </div>

            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="p-6 animate-pulse">
                    <div className="h-5 bg-[var(--color-bg-secondary)] rounded w-1/3 mb-3" />
                    <div className="h-4 bg-[var(--color-bg-secondary)] rounded w-1/4" />
                  </Card>
                ))}
              </div>
            ) : templates.length === 0 ? (
              <Card className="p-12 text-center">
                <div className="text-4xl mb-4">📜</div>
                <p className="font-medium text-[var(--color-text-primary)]">{t("adminTenant.noCertTemplates")}</p>
                <p className="text-sm mt-1 text-[var(--color-text-secondary)]">{t("adminTenant.certAutoCreated")}</p>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {templates.map((tpl) => {
                  const theme = parseJson<ThemeConfig>(tpl.themeConfig, DEFAULT_THEME);
                  const elements = parseJson<ElementsConfig>(tpl.elementsConfig, DEFAULT_ELEMENTS);
                  const signatories = parseJson<Signatory[]>(tpl.signatories, []);
                  const activeElements = Object.entries(elements).filter(([, v]) => v).length;

                  return (
                    <Card key={tpl.id} className="p-0 overflow-hidden">
                      <div
                        className="h-2"
                        style={{ background: `linear-gradient(to right, ${theme.primary_color}, ${theme.secondary_color})` }}
                      />
                      <div className="p-5">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{tpl.domain?.icon || "📜"}</span>
                            <div>
                              <h3 className="font-semibold text-[var(--color-text-primary)]">{tpl.templateName}</h3>
                              <p className="text-xs text-[var(--color-text-secondary)]">{tpl.domain?.name}</p>
                            </div>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => startEdit(tpl)}>
                            {t("common.edit")}
                          </Button>
                        </div>

                        <div className="flex flex-wrap gap-1.5 mb-3">
                          <Badge color={theme.primary_color}>{theme.title_font}</Badge>
                          <Badge variant="stardust">{activeElements} elements</Badge>
                          {signatories.length > 0 && (
                            <Badge variant="pulsar">
                              {signatories.length} signator{signatories.length > 1 ? "ies" : "y"}
                            </Badge>
                          )}
                        </div>

                        <div className="flex gap-2 items-center">
                          <div className="flex gap-1">
                            {[theme.primary_color, theme.secondary_color, theme.accent_color].map((c) => (
                              <div
                                key={c}
                                className="w-5 h-5 rounded-full border border-[var(--color-bg-secondary)]"
                                style={{ backgroundColor: c }}
                                title={c}
                              />
                            ))}
                          </div>
                          <span className="text-xs text-[var(--color-text-secondary)] ml-1 truncate" title={theme.seal_text}>
                            {theme.seal_text}
                          </span>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          /* ── EDIT MODE ── */
          <div>
            <button
              type="button"
              onClick={cancelEdit}
              className="flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors mb-4"
            >
              &larr; {t("adminTenant.backToTemplates")}
            </button>

            <div className="flex items-center gap-3 mb-6">
              <span className="text-3xl">{editingTpl?.domain?.icon || "📜"}</span>
              <div>
                <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {editName}
                </h1>
                <p className="text-[var(--color-text-secondary)] text-sm">{editingTpl?.domain?.name}</p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-6">
                {/* General */}
                <Card>
                  <CardHeader><CardTitle>{t("adminTenant.certGeneral")}</CardTitle></CardHeader>
                  <CardContent>
                    <Input
                      label={t("adminTenant.certTemplateName")}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </CardContent>
                </Card>

                {/* Theme */}
                <Card>
                  <CardHeader><CardTitle>{t("adminTenant.certTheme")}</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">{t("adminTenant.primary")}</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={editTheme.primary_color}
                            onChange={(e) => setEditTheme({ ...editTheme, primary_color: e.target.value })}
                            className="w-10 h-10 rounded-lg border border-[var(--color-bg-secondary)] cursor-pointer"
                          />
                          <Input value={editTheme.primary_color} onChange={(e) => setEditTheme({ ...editTheme, primary_color: e.target.value })} className="flex-1" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">{t("adminTenant.secondary")}</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={editTheme.secondary_color}
                            onChange={(e) => setEditTheme({ ...editTheme, secondary_color: e.target.value })}
                            className="w-10 h-10 rounded-lg border border-[var(--color-bg-secondary)] cursor-pointer"
                          />
                          <Input value={editTheme.secondary_color} onChange={(e) => setEditTheme({ ...editTheme, secondary_color: e.target.value })} className="flex-1" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">{t("adminTenant.accent")}</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={editTheme.accent_color}
                            onChange={(e) => setEditTheme({ ...editTheme, accent_color: e.target.value })}
                            className="w-10 h-10 rounded-lg border border-[var(--color-bg-secondary)] cursor-pointer"
                          />
                          <Input value={editTheme.accent_color} onChange={(e) => setEditTheme({ ...editTheme, accent_color: e.target.value })} className="flex-1" />
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">{t("adminTenant.certTitleFont")}</label>
                        <select
                          value={editTheme.title_font}
                          onChange={(e) => setEditTheme({ ...editTheme, title_font: e.target.value })}
                          className="w-full rounded-lg border border-[var(--color-bg-secondary)] bg-white dark:bg-[#1a1e18] px-3 py-2"
                        >
                          {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">{t("adminTenant.certBodyFont")}</label>
                        <select
                          value={editTheme.body_font}
                          onChange={(e) => setEditTheme({ ...editTheme, body_font: e.target.value })}
                          className="w-full rounded-lg border border-[var(--color-bg-secondary)] bg-white dark:bg-[#1a1e18] px-3 py-2"
                        >
                          {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                    </div>

                    <Input
                      label={t("adminTenant.certSealText")}
                      value={editTheme.seal_text}
                      onChange={(e) => setEditTheme({ ...editTheme, seal_text: e.target.value })}
                      hint={t("adminTenant.certSealHint")}
                    />
                  </CardContent>
                </Card>

                {/* Elements */}
                <Card>
                  <CardHeader><CardTitle>{t("adminTenant.certElements")}</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {(Object.keys(ELEMENT_LABELS) as Array<keyof ElementsConfig>).map((key) => (
                        <label key={key} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-[var(--color-bg-secondary)]/40 transition-colors">
                          <input
                            type="checkbox"
                            checked={editElements[key]}
                            onChange={(e) => setEditElements({ ...editElements, [key]: e.target.checked })}
                            className="w-4 h-4 rounded border-[var(--color-bg-secondary)] accent-[var(--color-accent)]"
                          />
                          <span className="text-sm text-[var(--color-text-primary)]">{ELEMENT_LABELS[key]}</span>
                        </label>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Signatories */}
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle>{t("adminTenant.certSignatories")}</CardTitle>
                      <Button variant="outline" size="sm" onClick={addSignatory}>
                        + {t("adminTenant.certAddSignatory")}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {editSignatories.length === 0 ? (
                      <p className="text-sm text-[var(--color-text-secondary)]">{t("adminTenant.certNoSignatories")}</p>
                    ) : (
                      <div className="space-y-3">
                        {editSignatories.map((sig, idx) => (
                          <div key={idx} className="flex gap-3 items-start">
                            <div className="flex-1 grid gap-3 sm:grid-cols-2">
                              <Input
                                placeholder={t("adminTenant.certSignatoryName")}
                                value={sig.name}
                                onChange={(e) => updateSignatory(idx, "name", e.target.value)}
                              />
                              <Input
                                placeholder={t("adminTenant.certSignatoryTitle")}
                                value={sig.title}
                                onChange={(e) => updateSignatory(idx, "title", e.target.value)}
                              />
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => removeSignatory(idx)} className="text-red-500 mt-1">
                              &times;
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Preview */}
              <div className="lg:col-span-1">
                <div className="sticky top-6">
                  <Card className="p-0 overflow-hidden">
                    <CardHeader className="bg-[var(--color-bg-secondary)]/40 border-b border-[var(--color-bg-secondary)]">
                      <CardTitle className="text-sm">{t("adminTenant.livePreview")}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div
                        className="border-2 rounded-lg p-4 relative aspect-[1.41/1] flex flex-col items-center justify-between text-center"
                        style={{ borderColor: editTheme.primary_color }}
                      >
                        <div
                          className="absolute top-0 left-0 right-0 h-1.5 rounded-t"
                          style={{ background: `linear-gradient(to right, ${editTheme.primary_color}, ${editTheme.secondary_color})` }}
                        />

                        <div className="flex flex-col items-center gap-1 mt-3">
                          {editElements.show_logo && (
                            <div className="w-8 h-8 rounded-full bg-[var(--color-bg-secondary)] flex items-center justify-center text-xs text-[var(--color-text-secondary)]">
                              Logo
                            </div>
                          )}
                          <p className="text-[10px] font-bold tracking-wider" style={{ color: editTheme.primary_color, fontFamily: editTheme.title_font }}>
                            CERTIFICATE OF COMPLETION
                          </p>
                        </div>

                        <div className="flex flex-col items-center gap-0.5">
                          <p className="text-[8px] text-[var(--color-text-secondary)]">This certifies that</p>
                          <p className="text-xs font-bold text-[var(--color-text-primary)]" style={{ fontFamily: editTheme.title_font }}>
                            John Learner
                          </p>
                          <p className="text-[8px] text-[var(--color-text-secondary)]">has completed</p>
                          <p className="text-[9px] font-semibold" style={{ color: editTheme.primary_color, fontFamily: editTheme.body_font }}>
                            {editingTpl?.domain?.name || "Domain"} Learning Path
                          </p>
                          {editElements.show_grade && (
                            <Badge color={editTheme.accent_color} className="mt-0.5 text-[8px]">DISTINCTION</Badge>
                          )}
                          {editElements.show_hours && (
                            <p className="text-[7px] text-[var(--color-text-secondary)] mt-0.5">12 learning hours</p>
                          )}
                        </div>

                        <div className="flex flex-col items-center gap-1 w-full">
                          {editElements.show_seal && (
                            <div
                              className="w-10 h-10 rounded-full border-2 flex items-center justify-center"
                              style={{ borderColor: editTheme.accent_color }}
                            >
                              <span className="text-[5px] font-bold text-center leading-tight" style={{ color: editTheme.accent_color }}>
                                {editTheme.seal_text.split(" ").slice(0, 2).join("\n")}
                              </span>
                            </div>
                          )}
                          {editElements.show_signature && editSignatories.length > 0 && (
                            <div className="flex gap-3 w-full justify-center">
                              {editSignatories.slice(0, 3).map((sig, i) => (
                                <div key={i} className="text-center">
                                  <div className="w-12 border-b border-[var(--color-text-secondary)] mb-0.5" />
                                  <p className="text-[6px] font-medium text-[var(--color-text-primary)]">{sig.name || "Name"}</p>
                                  <p className="text-[5px] text-[var(--color-text-secondary)]">{sig.title || "Title"}</p>
                                </div>
                              ))}
                            </div>
                          )}
                          {editElements.show_qr && (
                            <div className="w-6 h-6 bg-[var(--color-bg-secondary)] rounded-sm flex items-center justify-center">
                              <span className="text-[5px] text-[var(--color-text-secondary)]">QR</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex gap-3 mt-4">
                    <Button variant="outline" onClick={cancelEdit} className="flex-1">
                      {t("common.cancel")}
                    </Button>
                    <Button onClick={saveTemplate} disabled={saving} className="flex-1">
                      {saving ? t("common.saving") : t("adminTenant.certSaveTemplate")}
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
