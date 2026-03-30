"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { GeoStat } from "@/components/admin/users-geo-map";
import { GateAny } from "@/components/gate";

const UsersGeoMapLazy = dynamic(() => import("@/components/admin/users-geo-map"), {
  ssr: false,
  loading: () => <p className="text-sm text-[var(--color-text-secondary)]">Loading map…</p>,
});

type UserRow = {
  id: string;
  email: string;
  name: string;
  tenantId: string | null;
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

function UsersPageInner() {
  const sp = useSearchParams();
  const view = sp.get("view") === "map" ? "map" : "list";
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [geo, setGeo] = useState<GeoStat[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [countryFilter, setCountryFilter] = useState("");

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
    Promise.all([p1, p2]).catch((e) => {
      if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load");
    });
    return () => {
      cancelled = true;
    };
  }, [view]);

  const filtered = useMemo(() => {
    if (!users) return [];
    const q = countryFilter.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.country && u.country.toLowerCase().includes(q)) ||
        (u.city && u.city.toLowerCase().includes(q)),
    );
  }, [users, countryFilter]);

  const sortedGeo = useMemo(() => {
    if (!geo) return [];
    return [...geo].sort((a, b) => b.totalUsers - a.totalUsers);
  }, [geo]);

  return (
    <main className="p-6 md:p-10 max-w-5xl">
      <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">Users</h1>
      <p className="text-[var(--color-text-secondary)] mb-6">
        Directory and geography (full country names; city is approximate).
      </p>

      <GateAny
        anyOf={["users:manage", "users:view_map"]}
        fallback={<p className="text-sm text-amber-700">You do not have access to user admin tools.</p>}
      >
        <div className="flex gap-3 mb-6 text-sm">
          <Link
            href="/admin/users?view=list"
            className={view === "list" ? "font-semibold text-[var(--color-accent)]" : "text-[var(--color-text-secondary)]"}
          >
            List
          </Link>
          <span className="text-[var(--color-text-secondary)]">|</span>
          <Link
            href="/admin/users?view=map"
            className={view === "map" ? "font-semibold text-[var(--color-accent)]" : "text-[var(--color-text-secondary)]"}
          >
            Map
          </Link>
        </div>

        {err && <p className="text-sm text-red-600 mb-4">{err}</p>}

        {view === "list" && (
          <>
            <label className="block text-sm text-[var(--color-text-secondary)] mb-2">
              Filter by country or city
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
                      <th className="p-3">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((u) => (
                      <tr key={u.id} className="border-t border-[var(--color-border)]">
                        <td className="p-3">{u.name}</td>
                        <td className="p-3">{u.email}</td>
                        <td className="p-3">{locationDisplay(u)}</td>
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
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">By country</h2>
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
    </main>
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-[var(--color-text-secondary)]">Loading…</p>}>
      <UsersPageInner />
    </Suspense>
  );
}
