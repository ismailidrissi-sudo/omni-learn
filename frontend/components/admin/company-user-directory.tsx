"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { GeoStat } from "@/components/admin/users-geo-map";
import { GateAny } from "@/components/gate";
import { useUser } from "@/lib/use-user";
import { Button } from "@/components/ui/button";

const UsersGeoMapLazy = dynamic(() => import("@/components/admin/users-geo-map"), {
  ssr: false,
  loading: () => <p className="text-sm text-[var(--color-text-secondary)]">Loading map…</p>,
});

type TenantBrief = { id: string; name: string; slug: string } | null;

type UserRow = {
  id: string;
  email: string;
  name: string;
  tenantId: string | null;
  orgApprovalStatus?: string | null;
  tenant?: TenantBrief;
  country: string | null;
  countryCode: string | null;
  city: string | null;
  timezone: string | null;
};

function locationDisplay(u: UserRow): string {
  if (u.city && u.country) return `${u.city}, ${u.country}`;
  if (u.country) return u.country;
  return "—";
}

function CompanyUserDirectoryInner({ basePath }: { basePath: string }) {
  const sp = useSearchParams();
  const view = sp.get("view") === "map" ? "map" : "list";
  const { user: actor } = useUser();
  const isSuperAdmin = !!actor?.isAdmin;

  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [geo, setGeo] = useState<GeoStat[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [countryFilter, setCountryFilter] = useState("");
  const [tenants, setTenants] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [assignTenantByUser, setAssignTenantByUser] = useState<Record<string, string>>({});
  const [assignBusy, setAssignBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const p1 = apiFetch("/company/users")
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json() as Promise<UserRow[]>;
      })
      .then((data) => {
        if (!cancelled) setUsers(data);
      });
    const p2 =
      view === "map"
        ? apiFetch("/company/users/geo-distribution")
            .then(async (r) => {
              if (!r.ok) throw new Error(await r.text());
              return r.json() as Promise<GeoStat[]>;
            })
            .then((data) => {
              if (!cancelled) setGeo(data);
            })
        : Promise.resolve();
    const p3 = isSuperAdmin
      ? apiFetch("/company/tenants")
          .then(async (r) => {
            if (!r.ok) return [];
            return r.json() as Promise<{ id: string; name: string; slug: string }[]>;
          })
          .then((data) => {
            if (!cancelled) setTenants(Array.isArray(data) ? data : []);
          })
      : Promise.resolve();

    Promise.all([p1, p2, p3]).catch((e) => {
      if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load");
    });
    return () => {
      cancelled = true;
    };
  }, [view, isSuperAdmin]);

  const filtered = useMemo(() => {
    if (!users) return [];
    const q = countryFilter.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.country && u.country.toLowerCase().includes(q)) ||
        (u.city && u.city.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.name && u.name.toLowerCase().includes(q)),
    );
  }, [users, countryFilter]);

  const sortedGeo = useMemo(() => {
    if (!geo) return [];
    return [...geo].sort((a, b) => b.totalUsers - a.totalUsers);
  }, [geo]);

  const listHref = `${basePath}?view=list`;
  const mapHref = `${basePath}?view=map`;

  const assignAcademy = async (userId: string, tenantId: string | null) => {
    setAssignBusy(userId);
    setErr(null);
    try {
      const res = await apiFetch(`/company/users/${userId}/academy`, {
        method: "PATCH",
        body: JSON.stringify({ tenantId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? (await res.text()));
      const fresh = await apiFetch("/company/users").then((r) => r.json());
      setUsers(Array.isArray(fresh) ? fresh : []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Assign failed");
    } finally {
      setAssignBusy(null);
    }
  };

  return (
    <section>
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">User directory</h2>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6">
        Directory and geography (full country names; city is approximate).
      </p>

      <GateAny
        anyOf={["users:manage", "users:view_map"]}
        fallback={<p className="text-sm text-amber-700">You do not have access to user admin tools.</p>}
      >
        <div className="flex gap-3 mb-6 text-sm">
          <Link
            href={listHref}
            className={view === "list" ? "font-semibold text-[var(--color-accent)]" : "text-[var(--color-text-secondary)]"}
          >
            List
          </Link>
          <span className="text-[var(--color-text-secondary)]">|</span>
          <Link
            href={mapHref}
            className={view === "map" ? "font-semibold text-[var(--color-accent)]" : "text-[var(--color-text-secondary)]"}
          >
            Map
          </Link>
        </div>

        {err && <p className="text-sm text-red-600 mb-4">{err}</p>}

        {view === "list" && (
          <>
            <label className="block text-sm text-[var(--color-text-secondary)] mb-2">
              Filter by country, city, name, or email
              <input
                className="mt-1 block w-full max-w-md rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-[var(--color-text-primary)]"
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
              />
            </label>
            {!users && !err && <p className="text-sm text-[var(--color-text-secondary)]">Loading…</p>}
            {users && (
              <div className="overflow-x-auto border border-[var(--color-border)] rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-[var(--color-bg-secondary)] text-left">
                    <tr>
                      <th className="p-3">Name</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">Academy</th>
                      <th className="p-3">Location</th>
                      {isSuperAdmin && <th className="p-3 min-w-[220px]">Assign academy</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((u) => (
                      <tr key={u.id} className="border-t border-[var(--color-border)]">
                        <td className="p-3">{u.name}</td>
                        <td className="p-3">{u.email}</td>
                        <td className="p-3">
                          {u.tenant ? (
                            <span>
                              {u.tenant.name}
                              {u.orgApprovalStatus && u.orgApprovalStatus !== "APPROVED" && (
                                <span className="ml-1 text-xs text-amber-600">({u.orgApprovalStatus})</span>
                              )}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="p-3">{locationDisplay(u)}</td>
                        {isSuperAdmin && (
                          <td className="p-3 align-top">
                            <div className="flex flex-col gap-2 min-w-[200px]">
                              <select
                                className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2 py-1 text-xs text-[var(--color-text-primary)]"
                                value={assignTenantByUser[u.id] ?? u.tenantId ?? ""}
                                onChange={(e) =>
                                  setAssignTenantByUser((m) => ({ ...m, [u.id]: e.target.value }))
                                }
                              >
                                <option value="">— None —</option>
                                {tenants.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name}
                                  </option>
                                ))}
                              </select>
                              <div className="flex gap-1 flex-wrap">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="primary"
                                  className="text-xs h-8"
                                  disabled={assignBusy === u.id || !(assignTenantByUser[u.id] ?? u.tenantId)}
                                  onClick={() => {
                                    const tid = assignTenantByUser[u.id] ?? u.tenantId;
                                    if (tid) void assignAcademy(u.id, tid);
                                  }}
                                >
                                  {assignBusy === u.id ? "…" : "Assign"}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-8"
                                  disabled={assignBusy === u.id || !u.tenantId}
                                  onClick={() => void assignAcademy(u.id, null)}
                                >
                                  Remove
                                </Button>
                              </div>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {view === "map" && (
          <>
            {!geo && !err && <p className="text-sm text-[var(--color-text-secondary)] mb-4">Loading map…</p>}
            {geo && geo.length > 0 && <UsersGeoMapLazy stats={geo} />}
            <aside className="mt-6">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">By country</h3>
              <ul className="text-sm text-[var(--color-text-secondary)] space-y-1">
                {sortedGeo.map((s) => (
                  <li key={s.country}>
                    {s.country} ({s.totalUsers} users)
                  </li>
                ))}
              </ul>
            </aside>
          </>
        )}
      </GateAny>
    </section>
  );
}

export function CompanyUserDirectory({ basePath = "/admin/analytics/users" }: { basePath?: string }) {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--color-text-secondary)]">Loading…</p>}>
      <CompanyUserDirectoryInner basePath={basePath} />
    </Suspense>
  );
}
