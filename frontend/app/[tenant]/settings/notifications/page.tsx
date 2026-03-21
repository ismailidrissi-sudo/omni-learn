"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Bell, Loader2, Lock } from "lucide-react";
import { AppBurgerHeader } from "@/components/ui/app-burger-header";
import { LearnLogo } from "@/components/ui/learn-logo";
import { useI18n } from "@/lib/i18n/context";
import { apiFetch } from "@/lib/api";
import { learnerNavItems } from "@/lib/nav/burger-nav";
import { useUser } from "@/lib/use-user";
import { toast } from "@/lib/use-toast";

type EmailPrefRow = {
  id?: string;
  userId?: string;
  eventType: string;
  isEnabled: boolean;
};

const NO_TOGGLE = new Set([
  "password_reset_request",
  "password_reset_success",
  "email_verification",
]);

const CATEGORIES: { id: string; title: string; description: string; events: string[] }[] = [
  {
    id: "account",
    title: "Account",
    description: "Sign-in, activation, and access messages for your account.",
    events: ["email_verification", "account_activated", "account_approved", "account_rejected"],
  },
  {
    id: "learning",
    title: "Learning",
    description: "Enrollments, assignments, and completion notices.",
    events: ["enrollment_confirmed", "enrollment_assigned", "course_completed", "path_completed"],
  },
  {
    id: "content",
    title: "Content",
    description: "New items and personalized suggestions based on your activity.",
    events: ["new_content_in_category", "content_suggestion_browsing", "content_suggestion_trending"],
  },
  {
    id: "digest",
    title: "Digest",
    description: "Summaries and broadcast messages from your organization or platform.",
    events: ["weekly_digest", "admin_campaign", "scheduled_broadcast"],
  },
  {
    id: "security",
    title: "Security",
    description: "Security-related messages are always sent so you can recover access.",
    events: ["password_reset_request", "password_reset_success"],
  },
];

function formatEventLabel(eventType: string): string {
  return eventType
    .split("_")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export default function TenantEmailNotificationsPage() {
  const params = useParams();
  const slug = typeof params.tenant === "string" ? params.tenant : "";
  const router = useRouter();
  const { t } = useI18n();
  const { user, loading: userLoading } = useUser();

  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const navItems = useMemo(() => learnerNavItems(t, user, slug), [t, user, slug]);

  useEffect(() => {
    if (!userLoading && !user) {
      router.replace(`/${slug}/signin?redirect=/${slug}/settings/notifications`);
    }
  }, [userLoading, user, router, slug]);

  const loadPreferences = useCallback(async () => {
    try {
      const res = await apiFetch("/profile/email-preferences");
      if (!res.ok) throw new Error("Failed to load preferences");
      const data = await res.json();
      const rows: EmailPrefRow[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.preferences)
          ? data.preferences
          : [];
      const next: Record<string, boolean> = {};
      for (const row of rows) {
        if (row?.eventType) next[row.eventType] = row.isEnabled !== false;
      }
      setPrefs(next);
    } catch {
      toast("Could not load email preferences.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadPreferences();
  }, [user, loadPreferences]);

  const isEnabledFor = useCallback(
    (eventType: string) => {
      if (Object.prototype.hasOwnProperty.call(prefs, eventType)) {
        return prefs[eventType];
      }
      return true;
    },
    [prefs],
  );

  const handleToggle = async (eventType: string, next: boolean) => {
    if (NO_TOGGLE.has(eventType)) return;
    const prev = isEnabledFor(eventType);
    setPrefs((p) => ({ ...p, [eventType]: next }));
    setSavingKey(eventType);
    try {
      const res = await apiFetch("/profile/email-preferences", {
        method: "PUT",
        body: JSON.stringify({ eventType, isEnabled: next }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Save failed");
      }
      toast("Notification preference saved.", "success");
    } catch {
      setPrefs((p) => ({ ...p, [eventType]: prev }));
      toast("Could not update preference. Try again.", "error");
    } finally {
      setSavingKey(null);
    }
  };

  if (userLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="h-9 w-9 animate-spin text-indigo-400" aria-hidden />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AppBurgerHeader
        borderClassName="border-b border-slate-700/60"
        logoHref={`/${slug}`}
        logo={<LearnLogo size="md" variant="purple" />}
        items={navItems}
        trailing={
          <Link
            href={`/${slug}/learn`}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white hover:opacity-90 transition-opacity"
            title="My learning"
          >
            {(user.name ?? "")
              .split(" ")
              .map((w) => w[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)}
          </Link>
        }
      />

      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/15 ring-1 ring-indigo-500/25">
              <Bell className="h-6 w-6 text-indigo-400" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Email notifications</h1>
              <p className="text-sm text-slate-400">
                Choose which emails we send. Required messages are always delivered.
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-9 w-9 animate-spin text-indigo-400" aria-hidden />
          </div>
        ) : (
          <div className="space-y-6">
            {CATEGORIES.map((cat) => (
              <section
                key={cat.id}
                className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-6 shadow-lg shadow-black/20"
              >
                <h2 className="text-lg font-semibold text-white">{cat.title}</h2>
                <p className="mt-1 text-sm text-slate-400">{cat.description}</p>
                <ul className="mt-5 divide-y divide-slate-700/40">
                  {cat.events.map((eventType) => {
                    const locked = NO_TOGGLE.has(eventType);
                    const enabled = isEnabledFor(eventType);
                    const busy = savingKey === eventType;
                    return (
                      <li
                        key={eventType}
                        className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-slate-100">{formatEventLabel(eventType)}</p>
                          <p className="text-xs font-mono text-slate-500 truncate">{eventType}</p>
                        </div>
                        {locked ? (
                          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-600/80 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-400">
                            <Lock className="h-3.5 w-3.5" aria-hidden />
                            Always sent
                          </span>
                        ) : (
                          <button
                            type="button"
                            role="switch"
                            aria-checked={enabled}
                            disabled={busy}
                            onClick={() => void handleToggle(eventType, !enabled)}
                            className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 disabled:opacity-60 ${
                              enabled
                                ? "border-indigo-500/40 bg-indigo-600"
                                : "border-slate-600 bg-slate-700"
                            }`}
                          >
                            <span
                              className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
                                enabled ? "translate-x-7" : "translate-x-1"
                              }`}
                            />
                            {busy && (
                              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-slate-900/30">
                                <Loader2 className="h-4 w-4 animate-spin text-white" aria-hidden />
                              </span>
                            )}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
