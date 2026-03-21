"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Download } from "lucide-react";
import { downloadCsv } from "@/lib/csv-download";
import dynamic from "next/dynamic";

const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false },
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false },
);
const CircleMarker = dynamic(
  () => import("react-leaflet").then((m) => m.CircleMarker),
  { ssr: false },
);
const LeafletPopup = dynamic(
  () => import("react-leaflet").then((m) => m.Popup),
  { ssr: false },
);

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

  useEffect(() => {
    if (typeof window !== "undefined") {
      require("leaflet/dist/leaflet.css");
      setLeafletReady(true);
    }
  }, []);

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Map */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">User Locations</CardTitle>
          <button
            onClick={() => downloadCsv("/analytics/deep/export/geo", filters, "geography")}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-brand-purple text-white rounded-md hover:bg-brand-purple/90 transition-colors"
          >
            <Download size={14} /> Export CSV
          </button>
        </CardHeader>
        <CardContent>
          {leafletReady && data.locations.length > 0 ? (
            <div className="h-[400px] rounded-lg overflow-hidden border border-brand-grey-light/30">
              <MapContainer
                center={[30, 10]}
                zoom={2}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {data.locations.map((loc, i) => (
                  <CircleMarker
                    key={i}
                    center={[loc.lat, loc.lng]}
                    radius={6}
                    pathOptions={{ fillColor: "#6B4E9A", fillOpacity: 0.7, color: "#6B4E9A", weight: 1 }}
                  >
                    <LeafletPopup>
                      <span className="text-xs font-medium">
                        {loc.city ? `${loc.city}, ` : ""}{loc.country}
                      </span>
                    </LeafletPopup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
          ) : (
            <div className="h-[400px] flex items-center justify-center bg-brand-grey-light/10 rounded-lg">
              <p className="text-sm text-brand-grey">
                {data.locations.length === 0 ? "No location data available yet" : "Loading map..."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Country breakdown table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Sessions by Country</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {data.countries.map((c) => (
              <div key={c.country} className="flex items-center justify-between py-2 border-b border-brand-grey-light/20">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{c.country}</span>
                  <span className="text-xs text-brand-grey">{c.countryCode}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-1.5 bg-brand-grey-light/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-purple rounded-full"
                      style={{ width: `${Math.min(100, (c.sessions / (data.countries[0]?.sessions || 1)) * 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-12 text-right">{c.sessions}</span>
                </div>
              </div>
            ))}
            {data.countries.length === 0 && (
              <p className="text-sm text-brand-grey py-4 text-center">No geographic data available yet</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
