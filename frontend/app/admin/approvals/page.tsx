"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { GateAny } from "@/components/gate";

type ApprovalRow = {
  id: string;
  type: string;
  status: string;
  createdAt: string;
  requester: { name: string; email: string };
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  tenant?: { name?: string | null; slug?: string | null } | null;
};

type Category =
  | "ALL"
  | "PLAN_UPGRADE"
  | "COMPANY_JOIN"
  | "PRIVATE_LABEL"
  | "TRAINER_REQUEST"
  | "COMPANY_ADMIN_REQUEST"
  | "ACADEMY_AFFILIATION";

type QueueRow = {
  id: string;
  source: "APPROVAL_REQUEST" | "TRAINER_REQUEST" | "COMPANY_ADMIN_REQUEST" | "ACADEMY_AFFILIATION";
  category: Exclude<Category, "ALL">;
  title: string;
  createdAt: string;
  requester: { name: string; email: string };
  tenantName?: string | null;
};

const categoryLabels: Record<Category, string> = {
  ALL: "All requests",
  PLAN_UPGRADE: "Plan upgrades",
  COMPANY_JOIN: "Company join",
  PRIVATE_LABEL: "Private label",
  TRAINER_REQUEST: "Trainer requests",
  COMPANY_ADMIN_REQUEST: "Admin requests",
  ACADEMY_AFFILIATION: "Academy affiliation",
};

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return (await res.json()) as T;
}

function normalizeError(error: unknown): string {
  return error instanceof Error ? error.message : "Failed to load approvals";
}

async function loadAffiliationRequests(): Promise<UserRow[]> {
  const primary = await apiFetch("/profile/org-affiliation-requests");
  if (primary.ok) {
    return (await primary.json()) as UserRow[];
  }

  if (primary.status !== 400) {
    throw new Error(await primary.text());
  }

  const meRes = await apiFetch("/profile/me");
  const me = await parseJsonOrThrow<{ user?: { tenantId?: string | null } }>(meRes);
  const tenantId = me.user?.tenantId;
  if (!tenantId) return [];

  const scoped = await apiFetch(`/profile/org-affiliation-requests?tenantId=${encodeURIComponent(tenantId)}`);
  return parseJsonOrThrow<UserRow[]>(scoped);
}

export default function AdminApprovalsPage() {
  const [rows, setRows] = useState<QueueRow[] | null>(null);
  const [category, setCategory] = useState<Category>("ALL");
  const [actingKey, setActingKey] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function loadQueue() {
    setErr(null);

    try {
      const [approvalRes, trainerRes, companyAdminRes, affiliationRows] = await Promise.all([
        apiFetch("/approvals?status=PENDING"),
        apiFetch("/profile/trainer-requests"),
        apiFetch("/profile/company-admin-requests"),
        loadAffiliationRequests(),
      ]);

      const approvalRows = await parseJsonOrThrow<ApprovalRow[]>(approvalRes);

      const trainerRows = trainerRes.ok
        ? ((await trainerRes.json()) as UserRow[])
        : trainerRes.status === 403
          ? []
          : (() => {
              throw new Error("Failed to load trainer requests");
            })();

      const companyAdminRows = companyAdminRes.ok
        ? ((await companyAdminRes.json()) as UserRow[])
        : companyAdminRes.status === 403
          ? []
          : (() => {
              throw new Error("Failed to load company admin requests");
            })();

      const mergedRows: QueueRow[] = [
        ...approvalRows.map((row) => ({
          id: row.id,
          source: "APPROVAL_REQUEST" as const,
          category: (["PLAN_UPGRADE", "COMPANY_JOIN", "PRIVATE_LABEL"].includes(row.type)
            ? row.type
            : "PLAN_UPGRADE") as Exclude<Category, "ALL">,
          title: row.type.replace(/_/g, " "),
          createdAt: row.createdAt,
          requester: row.requester,
          tenantName: null,
        })),
        ...trainerRows.map((row) => ({
          id: row.id,
          source: "TRAINER_REQUEST" as const,
          category: "TRAINER_REQUEST" as const,
          title: "Trainer access request",
          createdAt: row.createdAt,
          requester: { name: row.name, email: row.email },
          tenantName: row.tenant?.name ?? null,
        })),
        ...companyAdminRows.map((row) => ({
          id: row.id,
          source: "COMPANY_ADMIN_REQUEST" as const,
          category: "COMPANY_ADMIN_REQUEST" as const,
          title: "Company admin role request",
          createdAt: row.createdAt,
          requester: { name: row.name, email: row.email },
          tenantName: row.tenant?.name ?? null,
        })),
        ...affiliationRows.map((row) => ({
          id: row.id,
          source: "ACADEMY_AFFILIATION" as const,
          category: "ACADEMY_AFFILIATION" as const,
          title: "Academy affiliation request",
          createdAt: row.createdAt,
          requester: { name: row.name, email: row.email },
          tenantName: row.tenant?.name ?? null,
        })),
      ].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

      setRows(mergedRows);
    } catch (error) {
      setErr(normalizeError(error));
    }
  }

  useEffect(() => {
    loadQueue();
  }, []);

  const visibleRows = useMemo(() => {
    if (!rows) return null;
    if (category === "ALL") return rows;
    return rows.filter((row) => row.category === category);
  }, [rows, category]);

  const counts = useMemo(() => {
    const map: Record<Category, number> = {
      ALL: rows?.length ?? 0,
      PLAN_UPGRADE: 0,
      COMPANY_JOIN: 0,
      PRIVATE_LABEL: 0,
      TRAINER_REQUEST: 0,
      COMPANY_ADMIN_REQUEST: 0,
      ACADEMY_AFFILIATION: 0,
    };
    (rows ?? []).forEach((row) => {
      map[row.category] += 1;
    });
    return map;
  }, [rows]);

  async function act(row: QueueRow, action: "approve" | "reject") {
    const key = `${row.source}:${row.id}:${action}`;
    setActingKey(key);
    setErr(null);

    try {
      if (row.source === "TRAINER_REQUEST") {
        const endpoint = action === "approve" ? "trainer-approve" : "trainer-reject";
        const res = await apiFetch(`/profile/users/${row.id}/${endpoint}`, { method: "PATCH" });
        if (!res.ok) throw new Error(await res.text());
      } else if (row.source === "COMPANY_ADMIN_REQUEST") {
        const endpoint = action === "approve" ? "company-admin-approve" : "company-admin-reject";
        const res = await apiFetch(`/profile/users/${row.id}/${endpoint}`, { method: "PATCH" });
        if (!res.ok) throw new Error(await res.text());
      } else if (row.source === "ACADEMY_AFFILIATION") {
        const endpoint = action === "approve" ? "org-approve" : "org-reject";
        const res = await apiFetch(`/profile/users/${row.id}/${endpoint}`, { method: "PATCH" });
        if (!res.ok) throw new Error(await res.text());
      }
      await loadQueue();
    } catch (error) {
      setErr(normalizeError(error));
    } finally {
      setActingKey(null);
    }
  }

  return (
    <main className="p-6 md:p-10 max-w-4xl">
      <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">Approvals</h1>
      <p className="text-[var(--color-text-secondary)] mb-6">
        Unified queue for plan upgrades, trainer/admin role requests, company join, private-label, and academy affiliations.
      </p>

      <GateAny
        anyOf={["approvals:review"]}
        fallback={<p className="text-sm text-amber-700">You do not have access to review approvals.</p>}
      >
        {rows && rows.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {Object.keys(categoryLabels).map((key) => {
              const c = key as Category;
              const active = c === category;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition ${
                    active
                      ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)]"
                      : "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border-[var(--color-border)]"
                  }`}
                >
                  {categoryLabels[c]} ({counts[c]})
                </button>
              );
            })}
          </div>
        )}

        {err && <p className="text-sm text-red-600 mb-4">{err}</p>}
        {!rows && !err && <p className="text-sm text-[var(--color-text-secondary)]">Loading…</p>}
        {visibleRows && visibleRows.length === 0 && (
          <p className="text-sm text-[var(--color-text-secondary)]">No pending approvals.</p>
        )}
        {visibleRows && visibleRows.length > 0 && (
          <ul className="divide-y divide-[var(--color-border)] border border-[var(--color-border)] rounded-lg overflow-hidden">
            {visibleRows.map((r) => (
              <li key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-[var(--color-bg-secondary)]">
                <div>
                  <p className="font-medium text-[var(--color-text-primary)]">{r.title}</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {r.requester.name} · {r.requester.email}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                    {categoryLabels[r.category]}
                    {r.tenantName ? ` · ${r.tenantName}` : ""}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                    {new Date(r.createdAt).toLocaleString()}
                  </p>
                </div>
                {r.source === "APPROVAL_REQUEST" ? (
                  <Link
                    href={`/admin/approvals/${r.id}`}
                    className="text-sm font-medium text-[var(--color-accent)] shrink-0"
                  >
                    Review →
                  </Link>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-xs px-3 py-1.5 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)]"
                      disabled={actingKey !== null}
                      onClick={() => act(r, "reject")}
                    >
                      {actingKey === `${r.source}:${r.id}:reject` ? "..." : "Reject"}
                    </button>
                    <button
                      type="button"
                      className="text-xs px-3 py-1.5 rounded bg-[var(--color-accent)] text-white"
                      disabled={actingKey !== null}
                      onClick={() => act(r, "approve")}
                    >
                      {actingKey === `${r.source}:${r.id}:approve` ? "..." : "Approve"}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </GateAny>
    </main>
  );
}
