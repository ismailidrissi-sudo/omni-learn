"use client";

import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function relativeTime(d: Date): string {
  const sec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} h ago`;
  return `${Math.floor(sec / 86400)} d ago`;
}

function wsBase(): string {
  try {
    const u = new URL(API_URL);
    u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
    return u.origin;
  } catch {
    return "ws://localhost:4000";
  }
}

export type LiveRow = {
  userName: string;
  city: string;
  country: string;
  action: string;
  contentTitle: string;
  timestamp: string;
};

type Props = {
  initial: LiveRow[];
  token: string | null;
};

export function LiveActivityFeed({ initial, token }: Props) {
  const [rows, setRows] = useState<LiveRow[]>(initial);

  useEffect(() => {
    setRows(initial);
  }, [initial]);

  useEffect(() => {
    if (!token) return;
    const socket: Socket = io(`${wsBase()}/ws/analytics`, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      auth: { token },
    });
    socket.on("analytics:live_activity", (payload: Record<string, unknown>) => {
      const userName = String(payload.userName ?? "");
      const city = String(payload.city ?? "");
      const country = String(payload.country ?? "");
      const action = String(payload.action ?? "");
      const contentTitle = String(payload.contentTitle ?? "");
      const timestamp = String(payload.timestamp ?? new Date().toISOString());
      setRows((prev) =>
        [{ userName, city, country, action, contentTitle, timestamp }, ...prev].slice(0, 20),
      );
    });
    return () => {
      socket.disconnect();
    };
  }, [token]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Live activity (last 30 min)</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 max-h-64 overflow-y-auto text-sm">
          {rows.length === 0 ? (
            <li className="text-[var(--color-text-muted)]">No recent activity.</li>
          ) : (
            rows.map((r, i) => (
              <li key={`${r.timestamp}-${i}`} className="flex gap-2 border-b border-[var(--color-bg-secondary)]/80 pb-2 last:border-0">
                <span className="text-emerald-500 shrink-0" aria-hidden>
                  ●
                </span>
                <span className="text-[var(--color-text-primary)]">
                  <span className="font-medium">{r.userName}</span>
                  {" — "}
                  {r.city ? `${r.city}, ` : ""}
                  {r.country}
                  {" — "}
                  {r.action}
                  {r.contentTitle ? ` “${r.contentTitle}”` : ""}
                  <span className="text-[var(--color-text-muted)] text-xs ml-2">
                    {relativeTime(new Date(r.timestamp))}
                  </span>
                </span>
              </li>
            ))
          )}
        </ul>
      </CardContent>
    </Card>
  );
}
