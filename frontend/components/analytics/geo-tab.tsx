"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Download } from "lucide-react";
import { downloadCsv } from "@/lib/csv-download";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";

const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const CircleMarker = dynamic(() => import("react-leaflet").then((m) => m.CircleMarker), { ssr: false });
const LeafletPopup = dynamic(() => import("react-leaflet").then((m) => m.Popup), { ssr: false });

interface GeoData {
  countries: { country: string; countryCode: string; sessions: number }[];
  locations: { lat: number; lng: number; city: string; country: string }[];
}

interface Props {
  data: GeoData | null;
  filters: Record<string, string | undefined>;
}

export function GeoTab({ data, filters }: Props) {
  const [leafletReady, setLeafletReady] = useState(false);
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";

  useEffect(() => {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("leaflet/dist/leaflet.css");
      setLeafletReady(true);
    }
  }, []);

  if (!data) return null;

  const tileUrl = dark
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  const tileAttr = dark
    ? '&copy; <a href="https://carto.com/">CARTO</a>'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">User Locations</CardTitle>
          <button
            onClick={() => downloadCsv("/analytics/deep/export/geo", filters, "geography")}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-brand-purple text-white rounded-lg hover:bg-brand-purple/90 transition-colors shadow-sm"
          >
            <Download size={14} /> Export CSV
          </button>
        </CardHeader>
        <CardContent>
          {leafletReady && data.locations.length > 0 ? (
            <div className="h-[420px] rounded-lg overflow-hidden border border-[var(--color-bg-secondary)]">
              <MapContainer center={[30, 10]} zoom={2} style={{ height: "100%", width: "100%" }} scrollWheelZoom={true}>
                <TileLayer attribution={tileAttr} url={tileUrl} />
                {data.locations.map((loc, i) => (
                  <CircleMarker
                    key={i}
                    center={[loc.lat, loc.lng]}
                    radius={7}
                    pathOptions={{ fillColor: "#10b981", fillOpacity: 0.8, color: "#059669", weight: 2 }}
                  >
                    <LeafletPopup>
                      <span className="text-xs font-medium">{loc.city ? `${loc.city}, ` : ""}{loc.country}</span>
                    </LeafletPopup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
          ) : (
            <div className="h-[420px] flex items-center justify-center bg-[var(--color-bg-secondary)]/30 rounded-lg">
              <p className="text-sm text-[var(--color-text-muted)]">
                {data.locations.length === 0 ? "No location data available yet" : "Loading map..."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Sessions by Country</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {data.countries.map((c) => (
              <div key={c.country} className="flex items-center justify-between py-2.5 border-b border-[var(--color-bg-secondary)] last:border-b-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">{c.country}</span>
                  <span className="text-xs text-[var(--color-text-muted)]">{c.countryCode}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-28 h-2 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-purple rounded-full transition-all"
                      style={{ width: `${Math.min(100, (c.sessions / (data.countries[0]?.sessions || 1)) * 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold w-12 text-right text-[var(--color-text-primary)]">{c.sessions}</span>
                </div>
              </div>
            ))}
            {data.countries.length === 0 && (
              <p className="text-sm text-[var(--color-text-muted)] py-8 text-center">No geographic data available yet</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
