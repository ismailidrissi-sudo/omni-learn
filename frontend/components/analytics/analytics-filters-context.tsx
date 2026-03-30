"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch } from "@/lib/api";

export type AnalyticsFiltersState = {
  from: string;
  to: string;
  tenantId: string;
  courseId: string;
  domainId: string;
  country: string;
  deviceType: string;
  gender: string;
  search: string;
};

const DEFAULT_FILTERS: AnalyticsFiltersState = {
  from: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
  to: new Date().toISOString().slice(0, 10),
  tenantId: "",
  courseId: "",
  domainId: "",
  country: "",
  deviceType: "",
  gender: "",
  search: "",
};

type Ctx = {
  filters: AnalyticsFiltersState;
  setFilters: (f: AnalyticsFiltersState) => void;
  filtersQuery: string;
  filtersRecord: Record<string, string | undefined>;
  tenants: { id: string; name: string }[];
  courses: { id: string; title: string }[];
  domains: { id: string; name: string }[];
  countries: string[];
  setCountries: (c: string[]) => void;
  resetPages: () => void;
  usersPage: number;
  setUsersPage: (n: number) => void;
  contentPage: number;
  setContentPage: (n: number) => void;
};

const AnalyticsFiltersContext = createContext<Ctx | null>(null);

export function AnalyticsFiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFiltersState] = useState<AnalyticsFiltersState>(DEFAULT_FILTERS);
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [domains] = useState<{ id: string; name: string }[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [usersPage, setUsersPage] = useState(1);
  const [contentPage, setContentPage] = useState(1);

  const setFilters = useCallback((f: AnalyticsFiltersState) => {
    setFiltersState(f);
    setUsersPage(1);
    setContentPage(1);
  }, []);

  const resetPages = useCallback(() => {
    setUsersPage(1);
    setContentPage(1);
  }, []);

  const filtersQuery = useMemo(() => {
    const p = new URLSearchParams();
    if (filters.from) p.set("from", filters.from);
    if (filters.to) p.set("to", filters.to);
    if (filters.tenantId) p.set("tenantId", filters.tenantId);
    if (filters.courseId) p.set("courseId", filters.courseId);
    if (filters.domainId) p.set("domainId", filters.domainId);
    if (filters.country) p.set("country", filters.country);
    if (filters.deviceType) p.set("deviceType", filters.deviceType);
    if (filters.gender) p.set("gender", filters.gender);
    if (filters.search) p.set("search", filters.search);
    return p.toString();
  }, [filters]);

  const filtersRecord = useMemo(() => {
    const r: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(filters)) {
      if (v) r[k] = v;
    }
    return r;
  }, [filters]);

  useEffect(() => {
    Promise.all([
      apiFetch("/company/tenants").then((r) => (r.ok ? r.json() : [])).catch(() => []),
      apiFetch("/content?type=COURSE&limit=100").then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ]).then(([t, c]) => {
      if (Array.isArray(t)) setTenants(t.map((x: Record<string, string>) => ({ id: x.id, name: x.name })));
      if (Array.isArray(c)) setCourses(c.map((x: Record<string, string>) => ({ id: x.id, title: x.title })));
    });
  }, []);

  const value = useMemo(
    () => ({
      filters,
      setFilters,
      filtersQuery,
      filtersRecord,
      tenants,
      courses,
      domains,
      countries,
      setCountries,
      resetPages,
      usersPage,
      setUsersPage,
      contentPage,
      setContentPage,
    }),
    [
      filters,
      setFilters,
      filtersQuery,
      filtersRecord,
      tenants,
      courses,
      domains,
      countries,
      resetPages,
      usersPage,
      contentPage,
    ],
  );

  return <AnalyticsFiltersContext.Provider value={value}>{children}</AnalyticsFiltersContext.Provider>;
}

export function useAnalyticsFilters() {
  const ctx = useContext(AnalyticsFiltersContext);
  if (!ctx) throw new Error("useAnalyticsFilters must be used within AnalyticsFiltersProvider");
  return ctx;
}
