"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";

/** Fetches the signed-in user's primary referral code (creates one if needed). */
export function useReferralShareCode(enabled: boolean): string | null {
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setCode(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/referral/share-code");
        if (!res.ok) return;
        const data = (await res.json()) as { code?: string };
        if (!cancelled && data.code) setCode(data.code);
      } catch {
        if (!cancelled) setCode(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return code;
}
