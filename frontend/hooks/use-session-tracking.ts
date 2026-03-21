"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { apiFetch, API_URL } from "@/lib/api";

const HEARTBEAT_INTERVAL_MS = 60_000;

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("omnilearn_token");
}

export function useSessionTracking() {
  const sessionIdRef = useRef<string | null>(null);
  const lastPathRef = useRef<string>("");
  const pageStartRef = useRef<number>(Date.now());
  const pathname = usePathname();

  const startSession = useCallback(async () => {
    if (!getToken()) return;

    try {
      let fingerprint: string | undefined;
      try {
        const FingerprintJS = await import("@fingerprintjs/fingerprintjs");
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        fingerprint = result.visitorId;
      } catch {
        // Fingerprinting unavailable
      }

      const res = await apiFetch("/analytics/session/start", {
        method: "POST",
        body: JSON.stringify({
          fingerprint,
          screenResolution: `${window.screen.width}x${window.screen.height}`,
          language: navigator.language,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        sessionIdRef.current = data.sessionId;
      }
    } catch {
      // Silent fail
    }
  }, []);

  const sendHeartbeat = useCallback(async () => {
    if (!sessionIdRef.current || !getToken()) return;
    try {
      await apiFetch("/analytics/session/heartbeat", {
        method: "POST",
        body: JSON.stringify({ sessionId: sessionIdRef.current }),
      });
    } catch {
      // Silent fail
    }
  }, []);

  const sendPageView = useCallback(async (path: string) => {
    if (!sessionIdRef.current || !getToken()) return;
    const duration = Math.floor((Date.now() - pageStartRef.current) / 1000);
    try {
      await apiFetch("/analytics/session/pageview", {
        method: "POST",
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          path: lastPathRef.current || path,
          durationSeconds: duration > 0 ? duration : 0,
        }),
      });
    } catch {
      // Silent fail
    }
    pageStartRef.current = Date.now();
  }, []);

  const endSession = useCallback(() => {
    if (!sessionIdRef.current) return;
    const payload = JSON.stringify({
      sessionId: sessionIdRef.current,
      userId: "",
    });
    const url = `${API_URL}/analytics/session/end`;
    if (typeof navigator.sendBeacon === "function") {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon(url, blob);
    }
    sessionIdRef.current = null;
  }, []);

  // Start session on mount
  useEffect(() => {
    startSession();

    const interval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    const handleBeforeUnload = () => endSession();
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      endSession();
    };
  }, [startSession, sendHeartbeat, endSession]);

  // Track page navigations
  useEffect(() => {
    if (pathname && pathname !== lastPathRef.current) {
      if (lastPathRef.current) {
        sendPageView(pathname);
      }
      lastPathRef.current = pathname;
      pageStartRef.current = Date.now();
    }
  }, [pathname, sendPageView]);
}
