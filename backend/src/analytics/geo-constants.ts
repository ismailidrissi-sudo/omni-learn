import { countries } from 'countries-list';
import iso3166 from 'i18n-iso-countries';

const CONTINENT_CODE_TO_NAME: Record<string, string> = {
  AF: 'Africa',
  AN: 'Antarctica',
  AS: 'Asia',
  EU: 'Europe',
  NA: 'North America',
  OC: 'Oceania',
  SA: 'South America',
};

/**
 * Collapse alpha-2, alpha-3 (e.g. MAR, CIV), and stray values into a single ISO 3166-1 alpha-2
 * key so analytics rollups and sessions aggregate one row per territory.
 */
export function normalizeCountryCodeForAggregation(code: string | null | undefined): string {
  if (!code || typeof code !== 'string') return 'ZZ';
  const t = code.trim().toUpperCase();
  if (!t) return 'ZZ';
  if (t.length === 2) {
    const row = countries[t as keyof typeof countries];
    return row ? t : 'ZZ';
  }
  if (t.length === 3) {
    const a2 = iso3166.alpha3ToAlpha2(t);
    if (a2) {
      const row = countries[a2 as keyof typeof countries];
      if (row) return a2;
    }
    return 'ZZ';
  }
  return 'ZZ';
}

/** English display name from ISO 3166-1 alpha-2 (e.g. MA -> Morocco). */
export function englishCountryNameFromCode(code: string | null | undefined): string | null {
  if (!code || code.length !== 2) return null;
  const upper = code.toUpperCase();
  const row = countries[upper as keyof typeof countries];
  return row?.name ?? null;
}

export function continentFromCountryCode(code: string | null | undefined): string | null {
  if (!code || code.length !== 2) return null;
  const upper = code.toUpperCase();
  const row = countries[upper as keyof typeof countries];
  if (!row?.continent) return null;
  return CONTINENT_CODE_TO_NAME[row.continent] ?? null;
}

export function formatLocation(city?: string | null, country?: string | null): string {
  if (city && country) return `${city}, ${country}`;
  if (country) return country;
  if (city) return city;
  return 'Unknown';
}

export type GeoResolutionSource = 'user_profile' | 'maxmind' | 'ipinfo' | 'geoip_lite' | 'ip_api';

export interface ResolvedGeo {
  country: string | null;
  countryCode: string | null;
  city: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  continent: string | null;
  source: GeoResolutionSource;
}
