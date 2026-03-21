"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles, CheckCircle2, XCircle } from "lucide-react";
import { LearnLogo } from "@/components/ui/learn-logo";
import { AppBurgerHeader } from "@/components/ui/app-burger-header";
import { adminHubNavItems } from "@/lib/nav/burger-nav";
import { useI18n } from "@/lib/i18n/context";
import { apiFetch } from "@/lib/api";

type SignupTrigger = { enabled: boolean; cooldownHours: number };
type InactivityTrigger = { enabled: boolean; cooldownDays: number; inactiveDays: number };
type WeeklyTrigger = { enabled: boolean };

interface SuggestionConfig {
  triggers: {
    postSignupDay1: SignupTrigger;
    postSignupDay3: SignupTrigger;
    postSignupDay7: SignupTrigger;
    inactivity: InactivityTrigger;
    weeklyDigest: WeeklyTrigger;
  };
  curatedContentIds: string[];
}

const EMPTY: SuggestionConfig = {
  triggers: {
    postSignupDay1: { enabled: true, cooldownHours: 48 },
    postSignupDay3: { enabled: true, cooldownHours: 48 },
    postSignupDay7: { enabled: true, cooldownHours: 72 },
    inactivity: { enabled: true, cooldownDays: 14, inactiveDays: 14 },
    weeklyDigest: { enabled: true },
  },
  curatedContentIds: [],
};

function Toggle({
  on,
  onToggle,
  disabled,
}: {
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onToggle}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        on ? "bg-indigo-500" : "bg-slate-600"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export default function ContentSuggestionsSettingsPage() {
  const { t } = useI18n();
  const adminNav = useMemo(() => adminHubNavItems(t), [t]);

  const [config, setConfig] = useState<SuggestionConfig>(EMPTY);
  const [curatedText, setCuratedText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await apiFetch("/admin/settings/content-suggestions");
      const data = (await res.json()) as SuggestionConfig;
      if (!res.ok) throw new Error((data as unknown as { message?: string }).message || "Failed to load");
      setConfig({
        triggers: { ...EMPTY.triggers, ...data.triggers },
        curatedContentIds: Array.isArray(data.curatedContentIds) ? data.curatedContentIds : [],
      });
      setCuratedText(
        (Array.isArray(data.curatedContentIds) ? data.curatedContentIds : []).join("\n"),
      );
    } catch (e) {
      setMessage({ type: "err", text: e instanceof Error ? e.message : "Failed to load configuration." });
      setConfig(EMPTY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const parseCuratedIds = (text: string): string[] =>
    text
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    const body: SuggestionConfig = {
      ...config,
      curatedContentIds: parseCuratedIds(curatedText),
    };
    try {
      const res = await apiFetch("/admin/settings/content-suggestions", {
        method: "PUT",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { message?: string }).message || "Save failed");
      }
      setConfig(data as SuggestionConfig);
      setCuratedText((data as SuggestionConfig).curatedContentIds.join("\n"));
      setMessage({ type: "ok", text: "Settings saved." });
    } catch (e) {
      setMessage({ type: "err", text: e instanceof Error ? e.message : "Save failed." });
    } finally {
      setSaving(false);
    }
  };

  const setTrigger = <K extends keyof SuggestionConfig["triggers"]>(
    key: K,
    patch: Partial<SuggestionConfig["triggers"][K]>,
  ) => {
    setConfig((c) => ({
      ...c,
      triggers: {
        ...c.triggers,
        [key]: { ...c.triggers[key], ...patch },
      },
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950">
        <AppBurgerHeader logoHref="/" logo={<LearnLogo size="md" variant="purple" />} items={adminNav} />
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <AppBurgerHeader logoHref="/" logo={<LearnLogo size="md" variant="purple" />} items={adminNav} />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h1 className="flex items-center gap-3 text-2xl font-bold text-white">
            <Sparkles className="h-7 w-7 text-indigo-400" />
            Content suggestion emails
          </h1>
          <p className="mt-1 text-slate-400">
            Control automated suggestion triggers and cooldowns. Configuration is stored on the server (
            <code className="text-indigo-300/90">data/suggestion-config.json</code>).
          </p>
        </div>

        {message && (
          <div
            className={`mb-6 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
              message.type === "ok"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-red-500/30 bg-red-500/10 text-red-300"
            }`}
          >
            {message.type === "ok" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 shrink-0" />
            )}
            {message.text}
          </div>
        )}

        <div className="space-y-4">
          {(
            [
              {
                key: "postSignupDay1" as const,
                title: "Post-signup — day 1",
                desc: "Users verified ~24h ago with no enrollments.",
                kind: "signup" as const,
              },
              {
                key: "postSignupDay3",
                title: "Post-signup — day 3",
                desc: "Users ~3 days after signup, still not enrolled.",
                kind: "signup" as const,
              },
              {
                key: "postSignupDay7",
                title: "Post-signup — day 7",
                desc: "Users ~7 days after signup, still not enrolled.",
                kind: "signup" as const,
              },
            ] as const
          ).map(({ key, title, desc }) => {
            const tr = config.triggers[key];
            return (
              <section
                key={key}
                className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="font-semibold text-white">{title}</h2>
                    <p className="mt-1 text-sm text-slate-400">{desc}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-400">Enabled</span>
                    <Toggle on={tr.enabled} onToggle={() => setTrigger(key, { enabled: !tr.enabled })} />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <label className="text-sm text-slate-300">
                    Cooldown (hours)
                    <input
                      type="number"
                      min={1}
                      value={tr.cooldownHours}
                      onChange={(e) =>
                        setTrigger(key, { cooldownHours: Math.max(1, parseInt(e.target.value, 10) || 1) })
                      }
                      className="ml-2 w-24 rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-2 text-white focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                  </label>
                </div>
              </section>
            );
          })}

          <section className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-white">Inactivity re-engagement</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Learners with no recent activity (per scheduler rules).
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-400">Enabled</span>
                <Toggle
                  on={config.triggers.inactivity.enabled}
                  onToggle={() =>
                    setTrigger("inactivity", { enabled: !config.triggers.inactivity.enabled })
                  }
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-6">
              <label className="text-sm text-slate-300">
                Cooldown (days)
                <input
                  type="number"
                  min={1}
                  value={config.triggers.inactivity.cooldownDays}
                  onChange={(e) =>
                    setTrigger("inactivity", {
                      cooldownDays: Math.max(1, parseInt(e.target.value, 10) || 1),
                    })
                  }
                  className="ml-2 w-24 rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-2 text-white focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </label>
              <label className="text-sm text-slate-300">
                Inactive after (days)
                <input
                  type="number"
                  min={1}
                  value={config.triggers.inactivity.inactiveDays}
                  onChange={(e) =>
                    setTrigger("inactivity", {
                      inactiveDays: Math.max(1, parseInt(e.target.value, 10) || 1),
                    })
                  }
                  className="ml-2 w-24 rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-2 text-white focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-white">Weekly digest</h2>
                <p className="mt-1 text-sm text-slate-400">Digest emails (when implemented by scheduler).</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-400">Enabled</span>
                <Toggle
                  on={config.triggers.weeklyDigest.enabled}
                  onToggle={() =>
                    setTrigger("weeklyDigest", { enabled: !config.triggers.weeklyDigest.enabled })
                  }
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5">
            <h2 className="font-semibold text-white">Curated content IDs</h2>
            <p className="mt-1 text-sm text-slate-400">
              Optional list of content item IDs for curated strategies (one per line or comma-separated).
            </p>
            <textarea
              value={curatedText}
              onChange={(e) => setCuratedText(e.target.value)}
              rows={4}
              placeholder="uuid-one&#10;uuid-two"
              className="mt-3 w-full rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-2 font-mono text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </section>
        </div>

        <div className="mt-8 flex items-center gap-4">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Save
          </button>
        </div>
      </main>
    </div>
  );
}
