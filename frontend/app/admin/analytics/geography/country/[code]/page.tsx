"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ApolloProvider, useQuery } from "@apollo/client/react";
import { apolloGeoClient } from "@/lib/apollo-geo-client";
import { COUNTRY_ANALYTICS } from "@/lib/geo-analytics-gql";
import { useAnalyticsFilters } from "@/components/analytics/analytics-filters-context";
import { CountryAnalyticsDetail, type CountryAnalyticsDetailModel } from "@/components/analytics/country-analytics-detail";
import { ErrorBanner } from "@/components/ui/error-banner";

function CountryInner() {
  const params = useParams();
  const code = typeof params.code === "string" ? params.code.toUpperCase() : "";
  const { filters } = useAnalyticsFilters();
  const tenantId = filters.tenantId || null;

  const period = useMemo(() => {
    const fromStr = filters.from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const toStr = filters.to || new Date().toISOString().slice(0, 10);
    return {
      start: new Date(fromStr + "T00:00:00.000Z"),
      end: new Date(toStr + "T23:59:59.999Z"),
    };
  }, [filters.from, filters.to]);

  const { data, loading, error } = useQuery(COUNTRY_ANALYTICS, {
    variables: {
      countryCode: code,
      tenantId,
      period: { start: period.start.toISOString(), end: period.end.toISOString() },
    },
    skip: !code,
    errorPolicy: "all",
  });

  const d = (data as { countryAnalytics?: CountryAnalyticsDetailModel } | undefined)?.countryAnalytics;

  return (
    <div className="space-y-6">
      <Link href="/admin/analytics/geography" className="text-sm text-brand-purple hover:underline">
        ← Back to world map
      </Link>

      {!filters.tenantId && (
        <p className="text-xs text-[var(--color-text-muted)]">
          All companies — this view aggregates users across every tenant you can access.
        </p>
      )}

      {error && (
        <ErrorBanner
          message={
            ("graphQLErrors" in error
              ? (error as unknown as { graphQLErrors: { message: string }[] }).graphQLErrors?.[0]?.message
              : undefined) ||
            error.message ||
            "Failed to load country analytics"
          }
          onDismiss={() => {}}
        />
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-purple border-t-transparent" />
        </div>
      )}

      {!loading && d && <CountryAnalyticsDetail data={d} countryCodeUpper={code} />}
    </div>
  );
}

export default function CountryDrilldownPage() {
  return (
    <ApolloProvider client={apolloGeoClient}>
      <CountryInner />
    </ApolloProvider>
  );
}
