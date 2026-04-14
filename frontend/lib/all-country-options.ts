import { countries } from "countries-list";

/** ISO 3166-1 alpha-2 list for filters when analytics data has not loaded yet. */
export const ALL_COUNTRY_OPTIONS: { code: string; name: string }[] = Object.entries(countries)
  .map(([code, v]) => ({ code, name: v.name }))
  .sort((a, b) => a.name.localeCompare(b.name));
