"use client";

import { memo, useMemo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import { scaleLinear } from "d3-scale";

const GEO_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson";

export type CountryMetricRow = {
  countryCode: string;
  country: string;
  value: number;
  topCity?: string | null;
};

type MetricKey =
  | "activeUsers"
  | "newRegistrations"
  | "courseCompletions"
  | "certsIssued"
  | "totalTimeSpentMin";

function metricLabel(m: MetricKey): string {
  switch (m) {
    case "newRegistrations":
      return "new signups";
    case "courseCompletions":
      return "completions";
    case "certsIssued":
      return "certificates";
    case "totalTimeSpentMin":
      return "learning minutes";
    default:
      return "active users";
  }
}

type Props = {
  data: CountryMetricRow[];
  metric: MetricKey;
  onCountryClick?: (countryCode: string) => void;
};

function WorldMapChoroplethInner({ data, metric, onCountryClick }: Props) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const colorScale = useMemo(
    () =>
      scaleLinear<string>()
        .domain([0, maxValue * 0.25, maxValue * 0.5, maxValue])
        .range(["#f0fdf4", "#86efac", "#22c55e", "#15803d"]),
    [maxValue],
  );

  const byCode = useMemo(() => {
    const m = new Map<string, CountryMetricRow>();
    for (const d of data) m.set(d.countryCode.toUpperCase(), d);
    return m;
  }, [data]);

  return (
    <div className="w-full overflow-hidden rounded-lg border border-[var(--color-bg-secondary)] bg-[var(--color-bg-primary)]">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 140, center: [0, 20] }}
        width={960}
        height={480}
        style={{ width: "100%", height: "auto", maxHeight: "min(55vh, 480px)" }}
      >
        <ZoomableGroup>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const iso =
                  (geo.properties.ISO_A2 as string)?.toUpperCase() ||
                  (geo.properties.WB_A2 as string)?.toUpperCase() ||
                  "";
                const match = iso ? byCode.get(iso) : undefined;
                const name = (geo.properties.NAME as string) || (geo.properties.ADMIN as string) || "";
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={() => match && onCountryClick?.(match.countryCode)}
                    style={{
                      default: {
                        fill: match ? colorScale(match.value) : "#e5e7eb",
                        stroke: "#d1d5db",
                        strokeWidth: 0.4,
                        outline: "none",
                        cursor: match ? "pointer" : "default",
                      },
                      hover: {
                        fill: match ? "#16a34a" : "#e5e7eb",
                        stroke: "#9ca3af",
                        strokeWidth: 0.8,
                        outline: "none",
                      },
                      pressed: { outline: "none" },
                    }}
                    tabIndex={match ? 0 : -1}
                    aria-label={
                      match
                        ? `${match.country}: ${match.value.toLocaleString()} ${metricLabel(metric)}`
                        : name
                    }
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>
      <p className="sr-only">
        Choropleth map by country. Use hover for counts; full country names are used in data, not codes.
      </p>
    </div>
  );
}

export const WorldMapChoropleth = memo(WorldMapChoroplethInner);
