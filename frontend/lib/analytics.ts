/**
 * Analytics tracking — POST /analytics/track
 * omnilearn.space | Phase 4
 */

import { apiFetch } from "@/lib/api";

export function track(
  eventType: string,
  payload?: { userId?: string; tenantId?: string; pathId?: string; contentId?: string; [k: string]: unknown }
) {
  apiFetch("/analytics/track", {
    method: "POST",
    body: JSON.stringify({ eventType, payload: payload ?? {} }),
  }).catch(() => {});
}
