"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useTenant } from "@/components/providers/tenant-context";
import { TenantAdminBurgerHeader } from "@/components/ui/tenant-admin-burger-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { toast } from "@/lib/use-toast";

type FooterLink = { label: string; url: string };

type EmailBrandingResponse = {
  id: string | null;
  tenantId: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textColor: string;
  backgroundColor: string;
  surfaceColor: string;
  borderRadius: string;
  fontFamily: string;
  fontFamilyAr: string;
  buttonStyle: Record<string, unknown>;
  senderName: string;
  senderEmail: string;
  replyToEmail: string | null;
  footerText: string | null;
  footerLinks: FooterLink[];
  customCss: string | null;
  isActive: boolean;
  isDefault?: boolean;
};

const API = "/company-admin/settings/email-branding";

const BTN_PRESETS: Record<string, Record<string, unknown>> = {
  rounded: { borderRadius: "8px", padding: "12px 24px", fontWeight: "600" },
  pill: { borderRadius: "9999px", padding: "12px 28px", fontWeight: "600" },
  minimal: { borderRadius: "4px", padding: "10px 20px", fontWeight: "500" },
};

function parsePx(r: string | undefined): number {
  if (!r) return 8;
  const m = String(r).match(/^(\d+(?:\.\d+)?)px$/);
  if (m) return Math.min(20, Math.max(0, parseFloat(m[1])));
  const n = parseFloat(String(r));
  return Number.isFinite(n) ? Math.min(20, Math.max(0, n)) : 8;
}

function presetFromButtonStyle(bs: Record<string, unknown> | undefined): string {
  if (!bs) return "rounded";
  const br = String(bs.borderRadius ?? "");
  if (br.includes("999") || br === "50%") return "pill";
  if (br === "4px" || br === "2px") return "minimal";
  return "rounded";
}

export default function EmailBrandingSettingsPage() {
  const params = useParams();
  const slug = typeof params.tenant === "string" ? params.tenant : "";
  const { tenant, branding, isLoading } = useTenant();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    logoUrl: "",
    primaryColor: "#6366F1",
    secondaryColor: "#1E1B4B",
    accentColor: "#F59E0B",
    textColor: "#1F2937",
    backgroundColor: "#FFFFFF",
    surfaceColor: "#F9FAFB",
    borderRadiusPx: 8,
    fontFamily: "Inter, system-ui, sans-serif",
    fontFamilyAr: "Noto Sans Arabic, Segoe UI, Arial, sans-serif",
    buttonPreset: "rounded",
    buttonStyle: { ...BTN_PRESETS.rounded } as Record<string, unknown>,
    senderName: "OmniLearn",
    senderEmail: "noreply@omnilearn.space",
    replyToEmail: "",
    footerText: "",
    footerLinks: [] as FooterLink[],
    customCss: "",
    isActive: true,
  });

  const academyName = branding?.appName || tenant?.name || "Academy";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(API);
      if (!res.ok) throw new Error(await res.text());
      const data: EmailBrandingResponse = await res.json();
      setForm({
        logoUrl: data.logoUrl ?? "",
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor,
        accentColor: data.accentColor,
        textColor: data.textColor,
        backgroundColor: data.backgroundColor,
        surfaceColor: data.surfaceColor,
        borderRadiusPx: parsePx(data.borderRadius),
        fontFamily: data.fontFamily,
        fontFamilyAr: data.fontFamilyAr,
        buttonPreset: presetFromButtonStyle(data.buttonStyle),
        buttonStyle: { ...(data.buttonStyle || BTN_PRESETS.rounded) },
        senderName: data.senderName,
        senderEmail: data.senderEmail,
        replyToEmail: data.replyToEmail ?? "",
        footerText: data.footerText ?? "",
        footerLinks: Array.isArray(data.footerLinks) ? data.footerLinks : [],
        customCss: data.customCss ?? "",
        isActive: data.isActive ?? true,
      });
    } catch {
      toast("Could not load email branding.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const setBorderRadiusPx = (px: number) => {
    const v = Math.min(20, Math.max(0, px));
    setForm((f) => ({
      ...f,
      borderRadiusPx: v,
      buttonStyle: {
        ...f.buttonStyle,
        borderRadius: `${Math.min(v, 16)}px`,
      },
    }));
  };

  const setButtonPreset = (preset: string) => {
    const base = BTN_PRESETS[preset] ?? BTN_PRESETS.rounded;
    setForm((f) => ({
      ...f,
      buttonPreset: preset,
      buttonStyle: { ...base },
    }));
  };

  const payload = useMemo(() => {
    const br = `${form.borderRadiusPx}px`;
    const btn = {
      ...form.buttonStyle,
      borderRadius: form.buttonStyle.borderRadius ?? br,
    };
    return {
      logoUrl: form.logoUrl.trim() || null,
      primaryColor: form.primaryColor,
      secondaryColor: form.secondaryColor,
      accentColor: form.accentColor,
      textColor: form.textColor,
      backgroundColor: form.backgroundColor,
      surfaceColor: form.surfaceColor,
      borderRadius: br,
      fontFamily: form.fontFamily,
      fontFamilyAr: form.fontFamilyAr,
      buttonStyle: btn,
      senderName: form.senderName,
      senderEmail: form.senderEmail,
      replyToEmail: form.replyToEmail.trim() || null,
      footerText: form.footerText.trim() || null,
      footerLinks: form.footerLinks.filter((l) => l.label.trim() || l.url.trim()),
      customCss: form.customCss.trim() || null,
      isActive: form.isActive,
    };
  }, [form]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiFetch(API, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      toast("Email branding saved.", "success");
      await load();
    } catch {
      toast("Could not save email branding.", "error");
    } finally {
      setSaving(false);
    }
  };

  const matchWebApp = async () => {
    setSaving(true);
    try {
      const res = await apiFetch(`${API}/match-web-app`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const data: EmailBrandingResponse = await res.json();
      setForm({
        logoUrl: data.logoUrl ?? "",
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor,
        accentColor: data.accentColor,
        textColor: data.textColor,
        backgroundColor: data.backgroundColor,
        surfaceColor: data.surfaceColor,
        borderRadiusPx: parsePx(data.borderRadius),
        fontFamily: data.fontFamily,
        fontFamilyAr: data.fontFamilyAr,
        buttonPreset: presetFromButtonStyle(data.buttonStyle),
        buttonStyle: { ...(data.buttonStyle || BTN_PRESETS.rounded) },
        senderName: data.senderName,
        senderEmail: data.senderEmail,
        replyToEmail: data.replyToEmail ?? "",
        footerText: data.footerText ?? "",
        footerLinks: Array.isArray(data.footerLinks) ? data.footerLinks : [],
        customCss: data.customCss ?? "",
        isActive: data.isActive ?? true,
      });
      toast("Matched web app branding.", "success");
    } catch {
      toast("Could not match web app branding.", "error");
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = async () => {
    setSaving(true);
    try {
      const res = await apiFetch(`${API}/reset`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const data: EmailBrandingResponse = await res.json();
      setForm({
        logoUrl: data.logoUrl ?? "",
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor,
        accentColor: data.accentColor,
        textColor: data.textColor,
        backgroundColor: data.backgroundColor,
        surfaceColor: data.surfaceColor,
        borderRadiusPx: parsePx(data.borderRadius),
        fontFamily: data.fontFamily,
        fontFamilyAr: data.fontFamilyAr,
        buttonPreset: "rounded",
        buttonStyle: { ...BTN_PRESETS.rounded },
        senderName: data.senderName,
        senderEmail: data.senderEmail,
        replyToEmail: data.replyToEmail ?? "",
        footerText: data.footerText ?? "",
        footerLinks: [],
        customCss: data.customCss ?? "",
        isActive: data.isActive ?? true,
      });
      toast("Email branding reset to defaults.", "success");
    } catch {
      toast("Could not reset email branding.", "error");
    } finally {
      setSaving(false);
    }
  };

  const addFooterLink = () => {
    update("footerLinks", [...form.footerLinks, { label: "", url: "" }]);
  };

  const setFooterLink = (index: number, field: keyof FooterLink, value: string) => {
    const next = [...form.footerLinks];
    next[index] = { ...next[index], [field]: value };
    update("footerLinks", next);
  };

  const removeFooterLink = (index: number) => {
    update(
      "footerLinks",
      form.footerLinks.filter((_, i) => i !== index),
    );
  };

  const previewBr = `${form.borderRadiusPx}px`;
  const btnRadius = String(form.buttonStyle.borderRadius ?? previewBr);

  if (isLoading || loading) {
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
        contextSlot={
          <span className="text-sm text-[var(--color-text-secondary)]">/ Email branding</span>
        }
      />

      <main className="max-w-6xl mx-auto p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Email branding</h1>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={matchWebApp} disabled={saving}>
              Match web app
            </Button>
            <Button variant="outline" onClick={resetDefaults} disabled={saving}>
              Reset to defaults
            </Button>
            <Button variant="primary" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Visual identity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-[var(--color-text-primary)]">Logo URL</label>
                  <Input
                    value={form.logoUrl}
                    onChange={(e) => update("logoUrl", e.target.value)}
                    placeholder="https://..."
                    className="mt-1"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(
                    [
                      ["primaryColor", "Primary"],
                      ["secondaryColor", "Secondary"],
                      ["accentColor", "Accent"],
                      ["textColor", "Text"],
                      ["backgroundColor", "Background"],
                      ["surfaceColor", "Surface"],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key}>
                      <label className="text-sm font-medium text-[var(--color-text-primary)]">{label}</label>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="color"
                          value={form[key]}
                          onChange={(e) => update(key, e.target.value)}
                          className="h-10 w-14 rounded cursor-pointer border border-[var(--color-bg-secondary)] bg-transparent"
                          aria-label={label}
                        />
                        <Input
                          value={form[key]}
                          onChange={(e) => update(key, e.target.value)}
                          className="flex-1 font-mono text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--color-text-primary)]">Font family (Latin)</label>
                  <Input
                    value={form.fontFamily}
                    onChange={(e) => update("fontFamily", e.target.value)}
                    className="mt-1"
                    placeholder="Inter, system-ui, sans-serif"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--color-text-primary)]">Font family (Arabic)</label>
                  <Input
                    value={form.fontFamilyAr}
                    onChange={(e) => update("fontFamilyAr", e.target.value)}
                    className="mt-1"
                    placeholder="Noto Sans Arabic, Segoe UI, Arial, sans-serif"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--color-text-primary)]">
                    Border radius: {form.borderRadiusPx}px
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={20}
                    value={form.borderRadiusPx}
                    onChange={(e) => setBorderRadiusPx(Number(e.target.value))}
                    className="w-full mt-2 accent-[var(--color-accent)]"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--color-text-primary)]">Button style</label>
                  <select
                    value={form.buttonPreset}
                    onChange={(e) => setButtonPreset(e.target.value)}
                    className="w-full mt-1 rounded-lg border border-[var(--color-bg-secondary)] bg-[var(--color-bg-secondary)]/30 px-3 py-2 text-[var(--color-text-primary)]"
                  >
                    <option value="rounded">Rounded</option>
                    <option value="pill">Pill</option>
                    <option value="minimal">Minimal</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--color-text-primary)]">Custom CSS</label>
                  <textarea
                    value={form.customCss}
                    onChange={(e) => update("customCss", e.target.value)}
                    rows={5}
                    placeholder="/* Applied in sent emails */"
                    className="w-full mt-1 rounded-lg border border-[var(--color-bg-secondary)] bg-[var(--color-bg-secondary)]/20 px-3 py-2 font-mono text-sm text-[var(--color-text-primary)]"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sender & footer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-[var(--color-text-primary)]">Sender name</label>
                  <Input
                    value={form.senderName}
                    onChange={(e) => update("senderName", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--color-text-primary)]">Sender email</label>
                  <Input
                    value={form.senderEmail}
                    onChange={(e) => update("senderEmail", e.target.value)}
                    className="mt-1"
                    type="email"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--color-text-primary)]">Reply-to email</label>
                  <Input
                    value={form.replyToEmail}
                    onChange={(e) => update("replyToEmail", e.target.value)}
                    className="mt-1"
                    type="email"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--color-text-primary)]">Footer text</label>
                  <textarea
                    value={form.footerText}
                    onChange={(e) => update("footerText", e.target.value)}
                    rows={3}
                    className="w-full mt-1 rounded-lg border border-[var(--color-bg-secondary)] bg-[var(--color-bg-secondary)]/20 px-3 py-2 text-[var(--color-text-primary)]"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-[var(--color-text-primary)]">Footer links</label>
                    <Button type="button" variant="outline" size="sm" onClick={addFooterLink}>
                      Add link
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {form.footerLinks.map((link, i) => (
                      <div key={i} className="flex flex-col sm:flex-row gap-2">
                        <Input
                          placeholder="Label"
                          value={link.label}
                          onChange={(e) => setFooterLink(i, "label", e.target.value)}
                        />
                        <Input
                          placeholder="https://"
                          value={link.url}
                          onChange={(e) => setFooterLink(i, "url", e.target.value)}
                        />
                        <Button type="button" variant="outline" onClick={() => removeFooterLink(i)}>
                          Remove
                        </Button>
                      </div>
                    ))}
                    {form.footerLinks.length === 0 && (
                      <p className="text-sm text-[var(--color-text-secondary)]">No footer links yet.</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:sticky lg:top-6 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Live preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="overflow-hidden border border-[var(--color-bg-secondary)] shadow-lg"
                  style={{
                    borderRadius: previewBr,
                    fontFamily: form.fontFamily,
                    backgroundColor: form.backgroundColor,
                    color: form.textColor,
                  }}
                >
                  <div
                    className="px-4 py-3 flex items-center gap-3"
                    style={{
                      backgroundColor: form.surfaceColor,
                      borderBottom: `1px solid ${form.secondaryColor}33`,
                    }}
                  >
                    {form.logoUrl ? (
                      <img src={form.logoUrl} alt="" className="h-9 w-auto max-w-[120px] object-contain" />
                    ) : (
                      <div
                        className="h-9 w-9 flex items-center justify-center text-white text-sm font-bold shrink-0"
                        style={{
                          backgroundColor: form.primaryColor,
                          borderRadius: previewBr,
                        }}
                      >
                        {(form.senderName || "A").charAt(0)}
                      </div>
                    )}
                    <span className="font-semibold text-sm truncate" style={{ color: form.textColor }}>
                      {form.senderName}
                    </span>
                  </div>
                  <div className="p-6" style={{ backgroundColor: form.backgroundColor }}>
                    <h2 className="text-lg font-bold mb-2" style={{ color: form.primaryColor }}>
                      Welcome to {academyName}
                    </h2>
                    <p className="text-sm mb-4 leading-relaxed" style={{ color: form.textColor }}>
                      This is a sample message. Your learners will see your colors, fonts, and sender details in
                      transactional emails.
                    </p>
                    <button
                      type="button"
                      className="text-white text-sm font-semibold"
                      style={{
                        backgroundColor: form.primaryColor,
                        borderRadius: btnRadius,
                        padding: String(form.buttonStyle.padding ?? "12px 24px"),
                        fontWeight: String(form.buttonStyle.fontWeight ?? "600"),
                      }}
                    >
                      Open course
                    </button>
                  </div>
                  <div
                    className="px-4 py-4 text-center text-xs space-y-2"
                    style={{ backgroundColor: form.surfaceColor, color: form.textColor }}
                  >
                    {form.footerText ? (
                      <p className="whitespace-pre-wrap opacity-90">{form.footerText}</p>
                    ) : (
                      <p className="opacity-50">Footer text appears here</p>
                    )}
                    {form.footerLinks.length > 0 && (
                      <div className="flex flex-wrap justify-center gap-3">
                        {form.footerLinks.map((l, i) =>
                          l.url ? (
                            <span
                              key={i}
                              style={{ color: form.accentColor }}
                              className="underline cursor-default"
                            >
                              {l.label || l.url}
                            </span>
                          ) : null,
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] mt-3">
                  Preview uses your colors and typography. Custom CSS applies in the sent HTML.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
