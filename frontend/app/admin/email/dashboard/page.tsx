"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Inbox,
  LayoutGrid,
  Layers,
  Loader2,
  Mail,
  RefreshCw,
  Send,
  Timer,
} from "lucide-react";
import { LearnLogo } from "@/components/ui/learn-logo";
import { AppBurgerHeader } from "@/components/ui/app-burger-header";
import { adminHubNavItems } from "@/lib/nav/burger-nav";
import { useI18n } from "@/lib/i18n/context";
import { apiFetch } from "@/lib/api";

interface LogStats {
  total: number;
  delivered: number;
  failed: number;
  bounced: number;
}

interface DashboardPayload {
  stats24h: LogStats;
  stats7d: LogStats;
  stats30d: LogStats;
  deliveryRate24h: number;
  bounceRate24h: number;
  lastSuccessfulSend: string | null;
  lastError: { message: string; at: string } | null;
}

interface QueueDashboard {
  queued: number;
  sending: number;
  scheduled: number;
  failed: number;
  total: number;
}

interface ProviderUsage {
  configured: boolean;
  thisMinute: number;
  thisHour: number;
  today: number;
  limitPerMinute: number;
  limitPerHour: number;
  limitPerDay: number;
  minuteResetAt: string | null;
  hourResetAt: string | null;
  dayResetAt: string | null;
  queueDepth?: number;
  estimatedClearMinutes?: number | null;
}

interface LogRow {
  id: string;
  recipientEmail: string;
  eventType: string;
  subject: string;
  status: string;
  createdAt: string;
  sentAt: string | null;
  errorMessage?: string | null;
}

function pctUsed(used: number, limit: number): number {
  if (!limit || limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 1000) / 10);
}

function formatTs(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-slate-700/50 bg-slate-800/50 p-5 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

function RateGauge({
  label,
  used,
  limit,
  resetAt,
}: {
  label: string;
  used: number;
  limit: number;
  resetAt: string | null;
}) {
  const pct = pctUsed(used, limit);
  const bar =
    pct >= 90 ? "bg-rose-500" : pct >= 70 ? "bg-amber-400" : "bg-indigo-500";
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-200">{label}</span>
        <span className="tabular-nums text-slate-400">
          {used} / {limit}
          <span className="ml-2 text-indigo-300">{pct}%</span>
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-900/80">
        <div
          className={`h-full rounded-full transition-all ${bar}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      {resetAt && (
        <p className="text-xs text-slate-500">Resets {formatTs(resetAt)}</p>
      )}
    </div>
  );
}

export default function EmailDeliveryDashboardPage() {
  const { t } = useI18n();
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [queue, setQueue] = useState<QueueDashboard | null>(null);
  const [usage, setUsage] = useState<ProviderUsage | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAll = useCallback(async (opts?: { silent?: boolean }) => {
    setError("");
    if (!opts?.silent) setLoading(true);
    try {
      const [dRes, qRes, uRes, lRes] = await Promise.all([
        apiFetch("/admin/email/dashboard"),
        apiFetch("/admin/email/dashboard/queue"),
        apiFetch("/admin/settings/email-provider/usage"),
        apiFetch("/admin/email/logs?perPage=20"),
      ]);

      if (!dRes.ok) {
        const d = await dRes.json().catch(() => ({}));
        throw new Error(d.message || "Failed to load dashboard");
      }
      if (!qRes.ok) {
        const d = await qRes.json().catch(() => ({}));
        throw new Error(d.message || "Failed to load queue stats");
      }
      if (!uRes.ok) {
        const d = await uRes.json().catch(() => ({}));
        throw new Error(d.message || "Failed to load provider usage");
      }
      if (!lRes.ok) {
        const d = await lRes.json().catch(() => ({}));
        throw new Error(d.message || "Failed to load logs");
      }

      setDashboard(await dRes.json());
      setQueue(await qRes.json());
      setUsage(await uRes.json());
      const logData = await lRes.json();
      setLogs(logData.items ?? []);
      setLogsTotal(logData.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void loadAll({ silent: true });
    }, 15_000);
    return () => window.clearInterval(id);
  }, [loadAll]);

  const queueCards = queue
    ? [
        { key: "queued", label: "Queued", value: queue.queued, icon: Layers },
        { key: "sending", label: "Sending", value: queue.sending, icon: Send },
        {
          key: "scheduled",
          label: "Scheduled",
          value: queue.scheduled,
          icon: Timer,
        },
        {
          key: "failed",
          label: "Failed",
          value: queue.failed,
          icon: AlertCircle,
        },
      ]
    : [];

  const statBuckets: { label: string; data: LogStats | undefined }[] = [
    { label: "Last 24 hours", data: dashboard?.stats24h },
    { label: "Last 7 days", data: dashboard?.stats7d },
    { label: "Last 30 days", data: dashboard?.stats30d },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AppBurgerHeader
        logoHref="/"
        logo={<LearnLogo size="md" variant="purple" />}
        items={adminHubNavItems(t)}
      />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Email delivery dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Live queue depth, provider rate limits, and audit log aggregates.
              Refreshes every 15 seconds.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadAll()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-800/50 px-3 py-2 text-sm text-slate-200 transition hover:border-indigo-500/40 hover:bg-slate-800"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 text-indigo-400" />
            )}
            Refresh
          </button>
        </div>

        {error && (
          <div className="mt-6 rounded-lg border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        <section className="mt-8 grid gap-4 lg:grid-cols-3">
          <Panel className="lg:col-span-3">
            <div className="mb-4 flex items-center gap-2 text-indigo-300">
              <Activity className="h-5 w-5" />
              <h2 className="text-lg font-semibold text-white">
                Provider rate limits
              </h2>
            </div>
            {!usage?.configured ? (
              <p className="text-sm text-slate-400">
                No active email provider config. Configure one under Email
                settings to see live usage.
              </p>
            ) : (
              <div className="grid gap-6 md:grid-cols-3">
                <RateGauge
                  label="Per minute"
                  used={usage.thisMinute}
                  limit={usage.limitPerMinute}
                  resetAt={usage.minuteResetAt}
                />
                <RateGauge
                  label="Per hour"
                  used={usage.thisHour}
                  limit={usage.limitPerHour}
                  resetAt={usage.hourResetAt}
                />
                <RateGauge
                  label="Per day"
                  used={usage.today}
                  limit={usage.limitPerDay}
                  resetAt={usage.dayResetAt}
                />
              </div>
            )}
            {usage?.configured && usage.queueDepth != null && (
              <p className="mt-4 text-xs text-slate-500">
                Queue depth (pending + scheduled):{" "}
                <span className="text-slate-300">{usage.queueDepth}</span>
                {usage.estimatedClearMinutes != null && (
                  <>
                    {" "}
                    · ~{usage.estimatedClearMinutes} min to clear at current
                    per-minute cap
                  </>
                )}
              </p>
            )}
          </Panel>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {queueCards.map(({ key, label, value, icon: Icon }) => (
            <Panel key={key}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-400">{label}</p>
                  <p className="mt-2 text-3xl font-semibold tabular-nums text-white">
                    {value}
                  </p>
                </div>
                <Icon className="h-8 w-8 text-indigo-400/80" />
              </div>
            </Panel>
          ))}
          {queue && (
            <Panel>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-400">Total in queue</p>
                  <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-200">
                    {queue.total}
                  </p>
                </div>
                <LayoutGrid className="h-8 w-8 text-slate-500" />
              </div>
            </Panel>
          )}
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {statBuckets.map(({ label, data }) => (
            <Panel key={label}>
              <div className="mb-3 flex items-center gap-2 text-indigo-300">
                <BarChart3 className="h-4 w-4" />
                <h3 className="font-medium text-slate-100">{label}</h3>
              </div>
              {data ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="text-slate-500">Total</dt>
                  <dd className="text-right tabular-nums text-slate-200">
                    {data.total}
                  </dd>
                  <dt className="text-slate-500">Delivered</dt>
                  <dd className="text-right tabular-nums text-emerald-400/90">
                    {data.delivered}
                  </dd>
                  <dt className="text-slate-500">Failed</dt>
                  <dd className="text-right tabular-nums text-rose-400/90">
                    {data.failed}
                  </dd>
                  <dt className="text-slate-500">Bounced</dt>
                  <dd className="text-right tabular-nums text-amber-400/90">
                    {data.bounced}
                  </dd>
                </dl>
              ) : (
                <p className="text-sm text-slate-500">—</p>
              )}
            </Panel>
          ))}
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <Panel>
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
              <span>Delivery & bounce (24h)</span>
            </h3>
            <div className="flex flex-wrap gap-3">
              <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-950/40 px-3 py-1 text-sm font-medium text-emerald-300">
                Delivery {dashboard?.deliveryRate24h ?? 0}%
              </span>
              <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-950/40 px-3 py-1 text-sm font-medium text-amber-200">
                Bounce {dashboard?.bounceRate24h ?? 0}%
              </span>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Delivery rate = delivered ÷ (delivered + failed + bounced) for log
              rows in the last 24h. Bounce rate = bounces ÷ total log rows in the
              last 24h.
            </p>
          </Panel>

          <Panel>
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
              <Mail className="h-4 w-4 text-indigo-400" />
              Provider health
            </h3>
            <div className="space-y-4 text-sm">
              <div className="flex gap-3 rounded-lg border border-slate-700/40 bg-slate-900/40 p-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                <div>
                  <p className="font-medium text-slate-200">
                    Last successful send
                  </p>
                  <p className="mt-1 text-slate-400">
                    {formatTs(dashboard?.lastSuccessfulSend ?? null)}
                  </p>
                </div>
              </div>
              <div className="flex gap-3 rounded-lg border border-slate-700/40 bg-slate-900/40 p-3">
                <Inbox className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
                <div>
                  <p className="font-medium text-slate-200">Last error</p>
                  {dashboard?.lastError ? (
                    <>
                      <p className="mt-1 text-rose-200/90">
                        {dashboard.lastError.message}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatTs(dashboard.lastError.at)}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-slate-500">No errors recorded</p>
                  )}
                </div>
              </div>
            </div>
          </Panel>
        </section>

        <section className="mt-8">
          <Panel>
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-white">
                Recent sends
              </h2>
              <span className="text-sm text-slate-500">
                {logsTotal} total · showing {logs.length}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-700/50 text-slate-400">
                    <th className="pb-2 pr-4 font-medium">Recipient</th>
                    <th className="pb-2 pr-4 font-medium">Subject</th>
                    <th className="pb-2 pr-4 font-medium">Event</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40">
                  {logs.length === 0 && !loading ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-8 text-center text-slate-500"
                      >
                        No log rows yet.
                      </td>
                    </tr>
                  ) : (
                    logs.map((row) => (
                      <tr key={row.id} className="text-slate-300">
                        <td className="py-2.5 pr-4 align-top">
                          {row.recipientEmail}
                        </td>
                        <td className="max-w-[220px] truncate py-2.5 pr-4 align-top text-slate-400">
                          {row.subject}
                        </td>
                        <td className="py-2.5 pr-4 align-top text-slate-400">
                          {row.eventType}
                        </td>
                        <td className="py-2.5 pr-4 align-top">
                          <span
                            className={`inline-flex rounded px-2 py-0.5 text-xs font-medium capitalize ${
                              row.status === "delivered" ||
                              row.status === "sent"
                                ? "bg-emerald-950/60 text-emerald-300"
                                : row.status === "failed" ||
                                    row.status === "bounced"
                                  ? "bg-rose-950/60 text-rose-300"
                                  : "bg-slate-800 text-slate-300"
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="py-2.5 align-top text-slate-500">
                          {formatTs(row.createdAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </section>
      </main>
    </div>
  );
}
