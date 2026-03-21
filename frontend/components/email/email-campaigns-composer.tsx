"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { apiFetch } from "@/lib/api";

export type AudienceMode = "all" | "learners" | "tenant";

type EmailCampaignRow = {
  id: string;
  subject: string;
  status: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  rateLimitedCount: number;
  createdAt: string;
};

type Props = {
  apiPrefix: "/admin/email-campaigns" | "/company-admin/email-campaigns";
  scope: "platform" | "tenant";
};

const panel = "rounded-xl border border-slate-700/50 bg-slate-800/50 p-6 shadow-sm";
const labelCls = "mb-1 block text-sm font-medium text-slate-200";
const fieldCls =
  "w-full rounded-lg border border-slate-600/80 bg-slate-900/50 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

function statusBadge(status: string) {
  const s = status.toLowerCase();
  const map: Record<string, string> = {
    draft: "bg-slate-600/80 text-slate-100",
    scheduled: "bg-indigo-900/60 text-indigo-100 ring-1 ring-indigo-500/40",
    sending: "bg-amber-900/50 text-amber-100 ring-1 ring-amber-500/30",
    sent: "bg-emerald-900/50 text-emerald-100 ring-1 ring-emerald-500/30",
    failed: "bg-red-900/50 text-red-100 ring-1 ring-red-500/30",
  };
  const cls = map[s] ?? "bg-slate-600/80 text-slate-100";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${cls}`}>{status}</span>
  );
}

function buildTargetFilter(
  scope: "platform" | "tenant",
  audience: AudienceMode,
  tenantIdInput: string
): Record<string, unknown> {
  if (scope === "tenant") {
    if (audience === "learners") return { userType: "TRAINEE" };
    return {};
  }
  if (audience === "all") return { all: true };
  if (audience === "learners") return { all: true, userType: "TRAINEE" };
  return { tenantId: tenantIdInput.trim() };
}

export function EmailCampaignsComposer({ apiPrefix, scope }: Props) {
  const [campaigns, setCampaigns] = useState<EmailCampaignRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [preview, setPreview] = useState(false);
  const [audience, setAudience] = useState<AudienceMode>("all");
  const [tenantId, setTenantId] = useState("");
  const [scheduleMode, setScheduleMode] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(apiPrefix);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load campaigns");
      setCampaigns(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, [apiPrefix]);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setSubject("");
    setBodyHtml("");
    setPreview(false);
    setAudience(scope === "platform" ? "all" : "all");
    setTenantId("");
    setScheduleMode("now");
    setScheduledAt("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      if (scope === "platform" && audience === "tenant" && !tenantId.trim()) {
        throw new Error("Enter a tenant ID for this audience.");
      }
      if (scheduleMode === "later") {
        if (!scheduledAt) throw new Error("Pick a schedule time.");
        const d = new Date(scheduledAt);
        if (Number.isNaN(d.getTime()) || d.getTime() <= Date.now()) {
          throw new Error("Schedule time must be in the future.");
        }
      }

      const targetFilter = buildTargetFilter(scope, audience, tenantId);
      const payload: Record<string, unknown> = {
        subject: subject.trim(),
        bodyHtml: bodyHtml.trim(),
        targetFilter,
      };
      if (scheduleMode === "later") {
        payload.scheduledAt = new Date(scheduledAt).toISOString();
      }

      const res = await apiFetch(apiPrefix, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const created = await res.json();
      if (!res.ok) throw new Error(created.message || "Failed to create campaign");

      if (scheduleMode === "now") {
        const sendRes = await apiFetch(`${apiPrefix}/${created.id}/send`, { method: "POST" });
        const sendBody = await sendRes.json().catch(() => ({}));
        if (!sendRes.ok) throw new Error(sendBody.message || "Campaign created but send failed");
      }

      setFormOpen(false);
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-slate-100">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-50">Email campaigns</h1>
          <p className="mt-1 text-sm text-slate-400">
            {scope === "platform"
              ? "Compose and send platform-wide campaigns to verified users."
              : "Compose and send email to verified users in your organization."}
          </p>
        </div>
        <Button
          type="button"
          className="border-indigo-500/40 bg-indigo-600 hover:bg-indigo-500"
          onClick={() => {
            setFormOpen(true);
            setError("");
          }}
        >
          New campaign
        </Button>
      </div>

      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} onDismiss={() => setError("")} />
        </div>
      )}

      <div className={`mt-6 ${panel}`}>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-100">Campaigns</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-slate-600 text-slate-200 hover:bg-slate-700/50"
            onClick={() => void load()}
            disabled={loading}
          >
            Refresh
          </Button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-700/40">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-900/40 text-slate-300">
              <tr>
                <th className="p-3 font-semibold">Subject</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold">Sent / total</th>
                <th className="p-3 font-semibold">Failed</th>
                <th className="p-3 font-semibold">Rate limited</th>
                <th className="p-3 font-semibold">Created</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="p-4 text-slate-400">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading &&
                campaigns?.map((c) => (
                  <tr key={c.id} className="border-t border-slate-700/40 bg-slate-900/20">
                    <td className="p-3 font-medium text-slate-100">{c.subject}</td>
                    <td className="p-3">{statusBadge(c.status)}</td>
                    <td className="p-3 tabular-nums text-slate-300">
                      {c.sentCount} / {c.totalRecipients}
                    </td>
                    <td className="p-3 tabular-nums text-slate-300">{c.failedCount}</td>
                    <td className="p-3 tabular-nums text-slate-300">{c.rateLimitedCount}</td>
                    <td className="p-3 text-xs text-slate-400">
                      {c.createdAt ? new Date(c.createdAt).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              {!loading && campaigns?.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-slate-400">
                    No campaigns yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="campaign-form-title"
        >
          <div className={`max-h-[90vh] w-full max-w-lg overflow-y-auto ${panel}`}>
            <div className="mb-4 flex items-start justify-between gap-2">
              <h2 id="campaign-form-title" className="text-lg font-semibold text-slate-100">
                New campaign
              </h2>
              <button
                type="button"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-700/50 hover:text-slate-200"
                onClick={() => {
                  setFormOpen(false);
                  resetForm();
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div>
                <label className={labelCls} htmlFor="camp-subject">
                  Subject
                </label>
                <input
                  id="camp-subject"
                  className={fieldCls}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                  autoComplete="off"
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className={`${labelCls} mb-0`} htmlFor="camp-body">
                    Body (HTML)
                  </label>
                  <button
                    type="button"
                    className="text-xs font-medium text-indigo-400 hover:text-indigo-300"
                    onClick={() => setPreview((p) => !p)}
                  >
                    {preview ? "Edit HTML" : "Preview"}
                  </button>
                </div>
                {preview ? (
                  <div
                    className="min-h-[160px] rounded-lg border border-slate-600/80 bg-white p-4 text-sm text-slate-900 prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: bodyHtml || "<p class='text-slate-500'>Empty</p>" }}
                  />
                ) : (
                  <textarea
                    id="camp-body"
                    className={`${fieldCls} min-h-[160px] font-mono text-xs`}
                    value={bodyHtml}
                    onChange={(e) => setBodyHtml(e.target.value)}
                    required
                    spellCheck={false}
                  />
                )}
              </div>

              <div>
                <span className={labelCls}>Audience</span>
                {scope === "platform" ? (
                  <>
                    <select
                      className={fieldCls}
                      value={audience}
                      onChange={(e) => setAudience(e.target.value as AudienceMode)}
                    >
                      <option value="all">All users</option>
                      <option value="learners">Learners only</option>
                      <option value="tenant">By tenant</option>
                    </select>
                    {audience === "tenant" && (
                      <div className="mt-2">
                        <label className={labelCls} htmlFor="camp-tenant">
                          Tenant ID
                        </label>
                        <input
                          id="camp-tenant"
                          className={fieldCls}
                          value={tenantId}
                          onChange={(e) => setTenantId(e.target.value)}
                          placeholder="UUID"
                          required={audience === "tenant"}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <select
                    className={fieldCls}
                    value={audience}
                    onChange={(e) => setAudience(e.target.value as AudienceMode)}
                  >
                    <option value="all">All users in this organization</option>
                    <option value="learners">Learners only</option>
                  </select>
                )}
              </div>

              <fieldset>
                <legend className={labelCls}>Schedule</legend>
                <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
                    <input
                      type="radio"
                      name="sched"
                      className="accent-indigo-500"
                      checked={scheduleMode === "now"}
                      onChange={() => setScheduleMode("now")}
                    />
                    Send now
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
                    <input
                      type="radio"
                      name="sched"
                      className="accent-indigo-500"
                      checked={scheduleMode === "later"}
                      onChange={() => setScheduleMode("later")}
                    />
                    Schedule
                  </label>
                </div>
                {scheduleMode === "later" && (
                  <input
                    type="datetime-local"
                    className={`${fieldCls} mt-2`}
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    required={scheduleMode === "later"}
                  />
                )}
              </fieldset>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-slate-600 text-slate-200 hover:bg-slate-700/50"
                  onClick={() => {
                    setFormOpen(false);
                    resetForm();
                  }}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="border-indigo-500/40 bg-indigo-600 hover:bg-indigo-500"
                >
                  {submitting ? "Working…" : scheduleMode === "now" ? "Create & send" : "Schedule campaign"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
