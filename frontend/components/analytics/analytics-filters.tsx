"use client";

import { useCallback, useMemo } from "react";
import { ALL_COUNTRY_OPTIONS } from "@/lib/all-country-options";
import { Download, X } from "lucide-react";
import { downloadCsv } from "@/lib/csv-download";

interface Filters {
  from: string;
  to: string;
  tenantId: string;
  courseId: string;
  domainId: string;
  country: string;
  deviceType: string;
  gender: string;
  search: string;
}

type CountryOption = { code: string; name: string };

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
  tenants: { id: string; name: string }[];
  courses: { id: string; title: string }[];
  domains: { id: string; name: string }[];
  countries: CountryOption[];
}

const DATE_PRESETS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "1y", days: 365 },
];

const inputCls =
  "px-2.5 py-1.5 text-xs border border-[var(--color-bg-secondary)] rounded-lg bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-brand-purple/40 transition-colors";

export function AnalyticsFilters({ filters, onChange, tenants, courses, domains, countries }: Props) {
  const mergedCountries = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of ALL_COUNTRY_OPTIONS) map.set(c.code, c.name);
    for (const c of countries) map.set(c.code, c.name);
    return [...map.entries()]
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [countries]);

  const set = useCallback(
    (key: keyof Filters, value: string) => onChange({ ...filters, [key]: value }),
    [filters, onChange],
  );

  const applyPreset = (days: number) => {
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    onChange({ ...filters, from, to });
  };

  const clearAll = () => {
    onChange({ from: "", to: "", tenantId: "", courseId: "", domainId: "", country: "", deviceType: "", gender: "", search: "" });
  };

  const hasActiveFilters = Object.values(filters).some(Boolean);

  const filtersRecord: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(filters)) {
    if (v) filtersRecord[k] = v;
  }

  return (
    <div className="sticky top-0 z-20 bg-[var(--color-bg-primary)] border-b border-[var(--color-bg-secondary)] px-6 py-3 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto flex flex-wrap gap-2 items-center">
        {/* Date presets */}
        <div className="flex rounded-lg border border-[var(--color-bg-secondary)] overflow-hidden">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.days}
              onClick={() => applyPreset(p.days)}
              className="px-3 py-1.5 text-xs font-medium hover:bg-brand-purple/10 hover:text-brand-purple transition-colors border-r border-[var(--color-bg-secondary)] last:border-r-0 text-[var(--color-text-secondary)]"
            >
              {p.label}
            </button>
          ))}
        </div>

        <input type="date" value={filters.from} onChange={(e) => set("from", e.target.value)} className={inputCls} />
        <input type="date" value={filters.to} onChange={(e) => set("to", e.target.value)} className={inputCls} />

        {tenants.length > 0 && (
          <select value={filters.tenantId} onChange={(e) => set("tenantId", e.target.value)} className={inputCls}>
            <option value="">All Companies</option>
            {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}

        {courses.length > 0 && (
          <select value={filters.courseId} onChange={(e) => set("courseId", e.target.value)} className={inputCls}>
            <option value="">All Courses</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        )}

        {domains.length > 0 && (
          <select value={filters.domainId} onChange={(e) => set("domainId", e.target.value)} className={inputCls}>
            <option value="">All Domains</option>
            {domains.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}

        <select value={filters.country} onChange={(e) => set("country", e.target.value)} className={inputCls} title="Filter by country (ISO code)">
          <option value="">All Countries</option>
          {mergedCountries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>

        <select value={filters.deviceType} onChange={(e) => set("deviceType", e.target.value)} className={inputCls}>
          <option value="">All Devices</option>
          <option value="DESKTOP">Desktop</option>
          <option value="MOBILE">Mobile</option>
          <option value="TABLET">Tablet</option>
        </select>

        <select value={filters.gender} onChange={(e) => set("gender", e.target.value)} className={inputCls}>
          <option value="">All Genders</option>
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
          <option value="OTHER">Other</option>
          <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
        </select>

        <input
          type="text"
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          placeholder="Search users..."
          className={`${inputCls} w-36`}
        />

        {hasActiveFilters && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-[var(--color-text-muted)] hover:text-brand-purple transition-colors"
          >
            <X size={12} /> Clear
          </button>
        )}

        <button
          onClick={() => downloadCsv("/analytics/deep/export/full", filtersRecord, "full-export")}
          className="ml-auto flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-brand-purple text-white rounded-lg hover:bg-brand-purple/90 transition-colors shadow-sm"
        >
          <Download size={14} />
          Export All
        </button>
      </div>
    </div>
  );
}
