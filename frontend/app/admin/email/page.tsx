"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { LearnLogo } from "@/components/ui/learn-logo";
import { AppBurgerHeader } from "@/components/ui/app-burger-header";
import { adminHubNavItems } from "@/lib/nav/burger-nav";
import { useI18n } from "@/lib/i18n/context";
import { apiFetch } from "@/lib/api";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Button } from "@/components/ui/button";

interface LogRow {
  id: string;
  recipientEmail: string;
  eventType: string;
  subject: string;
  status: string;
  providerMessageId: string | null;
  createdAt: string;
}

export default function AdminEmailOpsPage() {
  const { t } = useI18n();
  const [logs, setLogs] = useState<LogRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/admin/email/logs?perPage=50");
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load logs");
      setLogs(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  return (
    <div className="min-h-screen bg-background">
      <AppBurgerHeader logoHref="/" logo={<LearnLogo size="md" variant="purple" />} items={adminHubNavItems(t)} />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground">Email operations</h1>
        <p className="mt-2 text-muted-foreground">
          Super-admin API tools: campaigns, schedules, delivery logs, and provider settings. Uses the same JWT as other
          admin pages.
        </p>

        <ul className="mt-6 list-disc space-y-2 pl-6 text-sm">
          <li>
            <code className="rounded bg-muted px-1">GET /admin/email/logs</code> — delivery audit (
            {total} total{loading ? "…" : ""})
          </li>
          <li>
            <code className="rounded bg-muted px-1">GET/POST /admin/email-campaigns</code> — platform campaigns
          </li>
          <li>
            <code className="rounded bg-muted px-1">GET/POST /admin/email-schedules</code> — one-shot &amp; cron schedules
          </li>
          <li>
            <code className="rounded bg-muted px-1">POST /webhooks/resend</code> — Resend Svix webhooks (configure{" "}
            <code className="rounded bg-muted px-1">RESEND_WEBHOOK_SECRET</code>)
          </li>
          <li>
            <Link href="/admin/settings/email" className="text-primary underline">
              Email provider settings
            </Link>
          </li>
        </ul>

        <div className="mt-6 flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void loadLogs()} disabled={loading}>
            Refresh logs
          </Button>
        </div>

        {error && (
          <div className="mt-4">
            <ErrorBanner message={error} onDismiss={() => setError("")} />
          </div>
        )}

        <div className="mt-6 overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2">Status</th>
                <th className="p-2">Event</th>
                <th className="p-2">To</th>
                <th className="p-2">Subject</th>
                <th className="p-2">Provider id</th>
                <th className="p-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="p-4 text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading &&
                logs?.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="p-2 font-mono text-xs">{row.status}</td>
                    <td className="p-2 font-mono text-xs">{row.eventType}</td>
                    <td className="p-2">{row.recipientEmail}</td>
                    <td className="p-2 max-w-[200px] truncate" title={row.subject}>
                      {row.subject}
                    </td>
                    <td className="p-2 font-mono text-xs max-w-[120px] truncate">{row.providerMessageId ?? "—"}</td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              {!loading && logs?.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-muted-foreground">
                    No log rows yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
