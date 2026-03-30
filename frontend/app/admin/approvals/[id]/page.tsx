"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";

type Detail = {
  id: string;
  type: string;
  status: string;
  payload: Record<string, unknown>;
  reviewNote: string | null;
  requester: { id: string; name: string; email: string };
};

export default function AdminApprovalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const [row, setRow] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    apiFetch(`/approvals/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json() as Promise<Detail>;
      })
      .then(setRow)
      .catch((e) => setErr(e instanceof Error ? e.message : "Failed"));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(action: "approve" | "reject") {
    if (!id) return;
    setBusy(true);
    try {
      const r = await apiFetch(`/approvals/${id}/${action}`, { method: "POST", body: JSON.stringify({}) });
      if (!r.ok) throw new Error(await r.text());
      router.push("/admin/approvals");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="p-6 md:p-10 max-w-2xl">
      <Link href="/admin/approvals" className="text-sm text-[var(--color-accent)] mb-6 inline-block">
        ← Back to queue
      </Link>
      <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">Approval</h1>
      {err && <p className="text-sm text-red-600 mb-4">{err}</p>}
      {!row && !err && <p className="text-sm text-[var(--color-text-secondary)]">Loading…</p>}
      {row && (
        <>
          <div className="rounded-lg border border-[var(--color-border)] p-4 bg-[var(--color-bg-secondary)] space-y-2 text-sm mb-6">
            <p>
              <span className="text-[var(--color-text-secondary)]">Type:</span>{" "}
              <span className="font-medium">{row.type}</span>
            </p>
            <p>
              <span className="text-[var(--color-text-secondary)]">Status:</span>{" "}
              <span className="font-medium">{row.status}</span>
            </p>
            <p>
              <span className="text-[var(--color-text-secondary)]">Requester:</span>{" "}
              {row.requester.name} ({row.requester.email})
            </p>
            <pre className="text-xs bg-[var(--color-bg-primary)] p-2 rounded overflow-x-auto mt-2">
              {JSON.stringify(row.payload, null, 2)}
            </pre>
          </div>
          {row.status === "PENDING" && (
            <div className="flex gap-3">
              <Button type="button" disabled={busy} onClick={() => act("approve")}>
                Approve
              </Button>
              <Button type="button" variant="outline" disabled={busy} onClick={() => act("reject")}>
                Reject
              </Button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
