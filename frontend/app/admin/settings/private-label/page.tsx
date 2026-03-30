"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useUser } from "@/lib/use-user";
import { Button } from "@/components/ui/button";
import { Gate } from "@/components/gate";

export default function PrivateLabelSettingsPage() {
  const { user } = useUser();
  const [heroTitle, setHeroTitle] = useState("");
  const [heroSubtitle, setHeroSubtitle] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const tid = user?.tenantId;
    if (!tid) return;
    apiFetch(`/company/tenants/${tid}`)
      .then(async (r) => {
        if (!r.ok) return;
        const t = (await r.json()) as { privateLabelConfig?: Record<string, unknown> };
        const c = (t.privateLabelConfig ?? {}) as { hero_title?: string; hero_subtitle?: string };
        setHeroTitle(typeof c.hero_title === "string" ? c.hero_title : "");
        setHeroSubtitle(typeof c.hero_subtitle === "string" ? c.hero_subtitle : "");
      })
      .catch(() => undefined);
  }, [user?.tenantId]);

  async function save() {
    const tid = user?.tenantId;
    if (!tid) {
      setErr("No tenant on your account.");
      return;
    }
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await apiFetch(`/company/tenants/${tid}`, {
        method: "PUT",
        body: JSON.stringify({
          privateLabelConfig: {
            hero_title: heroTitle,
            hero_subtitle: heroSubtitle,
          },
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      setMsg("Saved.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="p-6 md:p-10 max-w-lg">
      <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">Private label</h1>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6">
        Landing hero copy stored in <code className="text-xs">privateLabelConfig</code> (JSON).
      </p>

      <Gate
        permission="company:manage_branding"
        fallback={<p className="text-sm text-amber-700">You need company branding permission.</p>}
      >
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="text-[var(--color-text-secondary)]">Hero title</span>
            <input
              className="mt-1 block w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2"
              value={heroTitle}
              onChange={(e) => setHeroTitle(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--color-text-secondary)]">Hero subtitle</span>
            <textarea
              className="mt-1 block w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 min-h-[80px]"
              value={heroSubtitle}
              onChange={(e) => setHeroSubtitle(e.target.value)}
            />
          </label>
          {msg && <p className="text-sm text-green-700">{msg}</p>}
          {err && <p className="text-sm text-red-600">{err}</p>}
          <Button type="button" disabled={busy} onClick={save}>
            Save
          </Button>
        </div>
      </Gate>
    </main>
  );
}
