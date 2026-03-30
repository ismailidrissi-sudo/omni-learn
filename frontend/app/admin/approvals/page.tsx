"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { GateAny } from "@/components/gate";

type Row = {
  id: string;
  type: string;
  status: string;
  createdAt: string;
  requester: { name: string; email: string };
};

export default function AdminApprovalsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/approvals?status=PENDING")
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json() as Promise<Row[]>;
      })
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="p-6 md:p-10 max-w-4xl">
      <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">Approvals</h1>
      <p className="text-[var(--color-text-secondary)] mb-6">
        Pending plan upgrades, company join requests, and private-label onboarding.
      </p>

      <GateAny
        anyOf={["approvals:review"]}
        fallback={<p className="text-sm text-amber-700">You do not have access to review approvals.</p>}
      >
        {err && <p className="text-sm text-red-600 mb-4">{err}</p>}
        {!rows && !err && <p className="text-sm text-[var(--color-text-secondary)]">Loading…</p>}
        {rows && rows.length === 0 && (
          <p className="text-sm text-[var(--color-text-secondary)]">No pending approvals.</p>
        )}
        {rows && rows.length > 0 && (
          <ul className="divide-y divide-[var(--color-border)] border border-[var(--color-border)] rounded-lg overflow-hidden">
            {rows.map((r) => (
              <li key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-[var(--color-bg-secondary)]">
                <div>
                  <p className="font-medium text-[var(--color-text-primary)]">{r.type.replace(/_/g, " ")}</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {r.requester.name} · {r.requester.email}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                    {new Date(r.createdAt).toLocaleString()}
                  </p>
                </div>
                <Link
                  href={`/admin/approvals/${r.id}`}
                  className="text-sm font-medium text-[var(--color-accent)] shrink-0"
                >
                  Review →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </GateAny>
    </main>
  );
}
