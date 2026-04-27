"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type CountryAnalyticsDetailModel = {
  country: string;
  countryCode: string;
  kpis: {
    registeredUsers?: number;
    activeUsers: number;
    newSignups: number;
    completions: number;
    certsIssued: number;
  };
  cities: {
    city: string;
    region?: string | null;
    totalUsers: number;
    activeUsers?: number;
    completions: number;
  }[];
  regions?: { region: string; users: number; sessions: number }[];
  locations?: { latitude: number; longitude: number; users: number }[];
  deviceBreakdown: { webPct: number; iosPct: number; androidPct: number };
  topLearners: { displayName: string; city?: string | null; points: number; pathsDone: number }[];
};

type Props = {
  data: CountryAnalyticsDetailModel;
  countryCodeUpper: string;
};

export function CountryAnalyticsDetail({ data: d, countryCodeUpper }: Props) {
  const code = countryCodeUpper.toUpperCase();
  const registered = d.kpis.registeredUsers ?? 0;
  const regions = d.regions ?? [];
  const locations = d.locations ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <img
          src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`}
          alt=""
          className="w-10 h-7 rounded shadow-sm object-cover"
          width={40}
          height={28}
        />
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{d.country}</h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            {registered.toLocaleString()} registered · {d.kpis.activeUsers.toLocaleString()} active in selected period
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(
          [
            ["Registered users", registered],
            ["Active users", d.kpis.activeUsers],
            ["New signups", d.kpis.newSignups],
            ["Completions", d.kpis.completions],
            ["Certificates", d.kpis.certsIssued],
          ] as const
        ).map(([label, val]) => (
          <Card key={label}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-[var(--color-text-muted)]">{label}</CardTitle>
            </CardHeader>
            <CardContent className="text-lg font-semibold">{Number(val).toLocaleString()}</CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Cities (registered profile + session activity)</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm space-y-2 max-h-80 overflow-y-auto">
            {d.cities.slice(0, 24).map((c, i) => {
              const label = c.region ? `${c.city}, ${c.region}` : c.city;
              const active = c.activeUsers ?? 0;
              return (
                <li
                  key={`${label}-${i}`}
                  className="flex justify-between border-b border-[var(--color-bg-secondary)]/80 py-2"
                >
                  <span>{label}</span>
                  <span className="text-[var(--color-text-muted)]">
                    {c.totalUsers} reg. · {active} active · {c.completions} compl.
                  </span>
                </li>
              );
            })}
          </ul>
          {d.cities.length === 0 && registered === 0 && (
            <p className="text-sm text-[var(--color-text-muted)]">No registered users in this country yet.</p>
          )}
          {d.cities.length === 0 && registered > 0 && (
            <p className="text-sm text-[var(--color-text-muted)]">
              Users are registered but no city is stored on profiles yet.
            </p>
          )}
        </CardContent>
      </Card>

      {regions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Regions (IPinfo)</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-2 max-h-80 overflow-y-auto">
              {regions.map((r) => (
                <li key={r.region} className="flex justify-between border-b border-[var(--color-bg-secondary)]/80 py-2">
                  <span>{r.region}</span>
                  <span className="text-[var(--color-text-muted)]">
                    {r.users.toLocaleString()} users · {r.sessions.toLocaleString()} sessions
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {locations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Approximate locations (IPinfo)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-[var(--color-text-muted)] mb-3">
              {locations.length} coordinate bucket{locations.length !== 1 ? "s" : ""} (lat/lng rounded to ~1 km).
            </p>
            <ul className="text-sm space-y-2">
              {locations.slice(0, 5).map((loc, i) => (
                <li key={i} className="flex justify-between border-b border-[var(--color-bg-secondary)]/80 py-2">
                  <span className="font-mono text-xs">
                    {loc.latitude.toFixed(2)}, {loc.longitude.toFixed(2)}
                  </span>
                  <span className="text-[var(--color-text-muted)]">{loc.users.toLocaleString()} users</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Device split</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          Web {d.deviceBreakdown.webPct}% · iOS {d.deviceBreakdown.iosPct}% · Android {d.deviceBreakdown.androidPct}%
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Top learners</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm space-y-2">
            {d.topLearners.map((u) => (
              <li key={u.displayName} className="flex justify-between">
                <span>
                  {u.displayName}
                  {u.city ? <span className="text-[var(--color-text-muted)]"> — {u.city}</span> : null}
                </span>
                <span className="text-[var(--color-text-muted)]">
                  {u.points} pts · {u.pathsDone} paths
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
