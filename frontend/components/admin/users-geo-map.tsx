"use client";

import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export type GeoStat = {
  country: string;
  countryCode: string;
  totalUsers: number;
  cities: { city: string; userCount: number }[];
};

const COORDS: Record<string, [number, number]> = {
  MA: [32.2, -6.8],
  US: [37.1, -95.7],
  FR: [46.2, 2.2],
  GB: [54.7, -3],
  SA: [24, 45],
  DE: [51.2, 10.4],
  ES: [40.4, -3.7],
  IT: [42.6, 12.6],
  IN: [22.4, 79.3],
  BR: [-14.2, -51.9],
};

function fallbackLng(label: string): number {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) | 0;
  return (Math.abs(h) % 280) - 140;
}

function UsersGeoMap({ stats }: { stats: GeoStat[] }) {
  return (
    <MapContainer center={[25, 10]} zoom={2} scrollWheelZoom className="h-[420px] w-full rounded-lg z-0">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {stats.map((s) => {
        const cc = (s.countryCode || "").toUpperCase().slice(0, 2);
        const [lat, lng] = COORDS[cc] ?? [15 + (s.totalUsers % 40), fallbackLng(s.country)];
        const r = Math.min(8 + s.totalUsers * 1.5, 48);
        return (
          <CircleMarker key={s.country} center={[lat, lng]} radius={r} pathOptions={{ fillOpacity: 0.55 }}>
            <Popup>
              <strong>{s.country}</strong> ({s.totalUsers} users)
              <ul className="mt-1 text-xs list-disc pl-4">
                {s.cities.slice(0, 5).map((c) => (
                  <li key={c.city}>
                    {c.city} area — {c.userCount}
                  </li>
                ))}
              </ul>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}

export default UsersGeoMap;
