"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LearnLogo } from "@/components/ui/learn-logo";
import { AppBurgerHeader } from "@/components/ui/app-burger-header";
import { adminHubNavItems } from "@/lib/nav/burger-nav";
import { useI18n } from "@/lib/i18n/context";
import { apiFetch } from "@/lib/api";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Button } from "@/components/ui/button";

interface EmailTemplateRow {
  id: string;
  slug: string;
  name: string;
  language: string;
  eventType: string | null;
  version: number;
  isActive: boolean;
}

interface PreviewResponse {
  subject: string;
  html: string;
  text: string | null;
  variables: unknown;
}

const LANGUAGES = [
  { value: "en", label: "English (en)" },
  { value: "fr", label: "Français (fr)" },
  { value: "ar", label: "العربية (ar)" },
];

const selectClass =
  "w-full rounded-lg border border-slate-700/50 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none ring-indigo-500/30 focus:border-indigo-500/50 focus:ring-2";

const inputClass =
  "w-full rounded-lg border border-slate-700/50 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none ring-indigo-500/30 focus:border-indigo-500/50 focus:ring-2";

export default function AdminEmailTemplatesPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<EmailTemplateRow[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loadingList, setLoadingList] = useState(true);

  const [slug, setSlug] = useState("");
  const [language, setLanguage] = useState("en");
  const [tenantId, setTenantId] = useState("");

  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  const slugOptions = useMemo(() => {
    if (!rows?.length) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const r of rows) {
      if (!seen.has(r.slug)) {
        seen.add(r.slug);
        out.push(r.slug);
      }
    }
    return out.sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const loadTemplates = useCallback(async () => {
    setLoadingList(true);
    setLoadError("");
    try {
      const res = await apiFetch("/admin/email/templates");
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load templates");
      const list = (data as EmailTemplateRow[]) ?? [];
      setRows(list);
      setSlug((prev) => {
        if (prev && list.some((r) => r.slug === prev)) return prev;
        return list[0]?.slug ?? "";
      });
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
      setRows([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const runPreview = useCallback(async () => {
    if (!slug.trim()) {
      setPreviewError("Select a template slug.");
      return;
    }
    setPreviewLoading(true);
    setPreviewError("");
    setPreview(null);
    try {
      const params = new URLSearchParams({
        slug: slug.trim(),
        language: language || "en",
      });
      const tid = tenantId.trim();
      if (tid) params.set("tenantId", tid);
      const res = await apiFetch(`/admin/email/templates/preview?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Preview failed");
      setPreview(data as PreviewResponse);
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setPreviewLoading(false);
    }
  }, [slug, language, tenantId]);

  const variablesDisplay = useMemo(() => {
    if (preview?.variables === undefined || preview?.variables === null) return "—";
    try {
      return JSON.stringify(preview.variables, null, 2);
    } catch {
      return String(preview.variables);
    }
  }, [preview?.variables]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AppBurgerHeader logoHref="/" logo={<LearnLogo size="md" variant="purple" />} items={adminHubNavItems(t)} />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-50">Email template preview</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Inspect DB-backed templates with branding resolution. Preview uses the active version for the slug and
          language (falls back to English when needed).
        </p>

        {loadError && (
          <div className="mt-4">
            <ErrorBanner message={loadError} onDismiss={() => setLoadError("")} />
          </div>
        )}

        <section className="mt-8 rounded-xl border border-slate-700/50 bg-slate-800/50 p-5 shadow-lg shadow-black/20">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-indigo-300/90">All templates</h2>
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-700/40">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-slate-700/50 bg-slate-900/50">
                <tr>
                  <th className="p-3 font-medium text-slate-300">Slug</th>
                  <th className="p-3 font-medium text-slate-300">Name</th>
                  <th className="p-3 font-medium text-slate-300">Language</th>
                  <th className="p-3 font-medium text-slate-300">Event type</th>
                  <th className="p-3 font-medium text-slate-300">Version</th>
                  <th className="p-3 font-medium text-slate-300">Active</th>
                </tr>
              </thead>
              <tbody>
                {loadingList && (
                  <tr>
                    <td colSpan={6} className="p-4 text-slate-400">
                      Loading…
                    </td>
                  </tr>
                )}
                {!loadingList &&
                  rows?.map((row) => (
                    <tr key={row.id} className="border-t border-slate-700/40 hover:bg-slate-800/40">
                      <td className="p-3 font-mono text-xs text-indigo-200">{row.slug}</td>
                      <td className="p-3">{row.name}</td>
                      <td className="p-3 font-mono text-xs">{row.language}</td>
                      <td className="p-3 font-mono text-xs text-slate-400">{row.eventType ?? "—"}</td>
                      <td className="p-3 font-mono text-xs">{row.version}</td>
                      <td className="p-3">
                        {row.isActive ? (
                          <span className="inline-flex rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                            Inactive
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                {!loadingList && rows?.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-4 text-slate-400">
                      No email templates in the database.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8 rounded-xl border border-slate-700/50 bg-slate-800/50 p-5 shadow-lg shadow-black/20">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-indigo-300/90">Preview</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-xs font-medium text-slate-400">
              Template (slug)
              <select className={`${selectClass} mt-1`} value={slug} onChange={(e) => setSlug(e.target.value)}>
                <option value="" disabled>
                  Select…
                </option>
                {slugOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-400">
              Language
              <select className={`${selectClass} mt-1`} value={language} onChange={(e) => setLanguage(e.target.value)}>
                {LANGUAGES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-400 sm:col-span-2 lg:col-span-2">
              Tenant ID (optional)
              <input
                type="text"
                className={`${inputClass} mt-1`}
                placeholder="UUID — omit for platform defaults"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                autoComplete="off"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              className="border border-indigo-500/40 bg-indigo-600 text-white hover:bg-indigo-500"
              disabled={previewLoading || !slug}
              onClick={() => void runPreview()}
            >
              {previewLoading ? "Loading…" : "Preview"}
            </Button>
          </div>
          {previewError && (
            <div className="mt-4">
              <ErrorBanner message={previewError} onDismiss={() => setPreviewError("")} />
            </div>
          )}
        </section>

        {preview && (
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-indigo-300/90">Rendered subject</h3>
              <p className="mt-3 break-words text-sm text-slate-100">{preview.subject}</p>
            </section>
            <section className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-indigo-300/90">Template variables</h3>
              <pre className="mt-3 max-h-48 overflow-auto rounded-lg border border-slate-700/40 bg-slate-900/80 p-3 font-mono text-xs text-slate-300">
                {variablesDisplay}
              </pre>
            </section>
            <section className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5 lg:col-span-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-indigo-300/90">HTML preview</h3>
              <div className="mt-3 overflow-hidden rounded-lg border border-slate-700/40 bg-white">
                <iframe title="Email HTML preview" className="h-[min(70vh,720px)] w-full bg-white" srcDoc={preview.html} />
              </div>
            </section>
            {preview.text != null && preview.text !== "" && (
              <section className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5 lg:col-span-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-indigo-300/90">Plain text</h3>
                <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-700/40 bg-slate-900/80 p-3 font-mono text-xs text-slate-300">
                  {preview.text}
                </pre>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
