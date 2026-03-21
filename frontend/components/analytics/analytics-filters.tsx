"use client";

import { useCallback } from "react";
import { Download } from "lucide-react";
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

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
  tenants: { id: string; name: string }[];
  courses: { id: string; title: string }[];
  domains: { id: string; name: string }[];
  countries: string[];
}

const DATE_PRESETS = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "1 year", days: 365 },
];

export function AnalyticsFilters({ filters, onChange, tenants, courses, domains, countries }: Props) {
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

  const filtersRecord: Record<string, string | undefined> = {
    from: filters.from || undefined,
    to: filters.to || undefined,
    tenantId: filters.tenantId || undefined,
    courseId: filters.courseId || undefined,
    domainId: filters.domainId || undefined,
    country: filters.country || undefined,
    deviceType: filters.deviceType || undefined,
    gender: filters.gender || undefined,
    search: filters.search || undefined,
  };

  return (
    <div className="sticky top-0 z-20 bg-white dark:bg-[#0f1510] border-b border-brand-grey-light/30 px-6 py-4">
      <div className="flex flex-wrap gap-2 items-center">
        {/* Date presets */}
        <div className="flex gap-1">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.days}
              onClick={() => applyPreset(p.days)}
              className="px-3 py-1.5 text-xs rounded-md border border-brand-grey-light/50 hover:bg-brand-purple/10 hover:border-brand-purple transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>

        <input
          type="date"
          value={filters.from}
          onChange={(e) => set("from", e.target.value)}
          className="px-2 py-1.5 text-xs border border-brand-grey-light/50 rounded-md bg-white dark:bg-[#1a1a2e]"
          placeholder="From"
        />
        <input
          type="date"
          value={filters.to}
          onChange={(e) => set("to", e.target.value)}
          className="px-2 py-1.5 text-xs border border-brand-grey-light/50 rounded-md bg-white dark:bg-[#1a1a2e]"
          placeholder="To"
        />

        {tenants.length > 0 && (
          <select
            value={filters.tenantId}
            onChange={(e) => set("tenantId", e.target.value)}
            className="px-2 py-1.5 text-xs border border-brand-grey-light/50 rounded-md bg-white dark:bg-[#1a1a2e]"
          >
            <option value="">All Companies</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}

        {courses.length > 0 && (
          <select
            value={filters.courseId}
            onChange={(e) => set("courseId", e.target.value)}
            className="px-2 py-1.5 text-xs border border-brand-grey-light/50 rounded-md bg-white dark:bg-[#1a1a2e]"
          >
            <option value="">All Courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        )}

        {domains.length > 0 && (
          <select
            value={filters.domainId}
            onChange={(e) => set("domainId", e.target.value)}
            className="px-2 py-1.5 text-xs border border-brand-grey-light/50 rounded-md bg-white dark:bg-[#1a1a2e]"
          >
            <option value="">All Domains</option>
            {domains.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        )}

        {countries.length > 0 && (
          <select
            value={filters.country}
            onChange={(e) => set("country", e.target.value)}
            className="px-2 py-1.5 text-xs border border-brand-grey-light/50 rounded-md bg-white dark:bg-[#1a1a2e]"
          >
            <option value="">All Countries</option>
            {countries.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}

        <select
          value={filters.deviceType}
          onChange={(e) => set("deviceType", e.target.value)}
          className="px-2 py-1.5 text-xs border border-brand-grey-light/50 rounded-md bg-white dark:bg-[#1a1a2e]"
        >
          <option value="">All Devices</option>
          <option value="DESKTOP">Desktop</option>
          <option value="MOBILE">Mobile</option>
          <option value="TABLET">Tablet</option>
        </select>

        <select
          value={filters.gender}
          onChange={(e) => set("gender", e.target.value)}
          className="px-2 py-1.5 text-xs border border-brand-grey-light/50 rounded-md bg-white dark:bg-[#1a1a2e]"
        >
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
          className="px-2 py-1.5 text-xs border border-brand-grey-light/50 rounded-md bg-white dark:bg-[#1a1a2e] w-40"
        />

        <button
          onClick={clearAll}
          className="px-3 py-1.5 text-xs text-brand-grey hover:text-brand-purple transition-colors"
        >
          Clear
        </button>

        <button
          onClick={() => downloadCsv("/analytics/deep/export/full", filtersRecord, "full-export")}
          className="ml-auto flex items-center gap-1 px-3 py-1.5 text-xs bg-brand-purple text-white rounded-md hover:bg-brand-purple/90 transition-colors"
        >
          <Download size={14} />
          Export All
        </button>
      </div>
    </div>
  );
}
