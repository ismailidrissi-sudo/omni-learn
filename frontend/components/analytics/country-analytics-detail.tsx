"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/context";

export type CountryAnalyticsDetailModel = {
  country: string;
  countryCode: string;
  kpis: {
    activeUsers: number;
    newSignups: number;
    completions: number;
    certsIssued: number;
  };
  cities: { city: string; totalUsers: number; completions: number }[];
  deviceBreakdown: { webPct: number; iosPct: number; androidPct: number };
  topLearners: { displayName: string; city?: string | null; points: number; pathsDone: number }[];
};

type Props = {
  data: CountryAnalyticsDetailModel;
  countryCodeUpper: string;
};

export function CountryAnalyticsDetail({ data: d, countryCodeUpper }: Props) {
  const { t } = useI18n();
  const code = countryCodeUpper.toUpperCase();

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
            {d.kpis.activeUsers.toLocaleString()} users in selected period
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(
          [
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
          <CardTitle className="text-sm font-medium">Cities (approximate)</CardTitle>
          <p className="text-xs text-[var(--color-text-muted)] font-normal mt-1">{t("admin.geoCityBreakdownHint")}</p>
        </CardHeader>
        <CardContent>
          <ul className="text-sm space-y-2 max-h-80 overflow-y-auto">
            {d.cities.slice(0, 24).map((c) => (
              <li key={c.city} className="flex justify-between border-b border-[var(--color-bg-secondary)]/80 py-2">
                <span>{c.city}</span>
                <span className="text-[var(--color-text-muted)]">
                  {c.totalUsers} users · {c.completions} compl.
                </span>
              </li>
            ))}
          </ul>
          {d.cities.length === 0 && (
            <p className="text-sm text-[var(--color-text-muted)]">No city breakdown for this period.</p>
          )}
        </CardContent>
      </Card>

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
