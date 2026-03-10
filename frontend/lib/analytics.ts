/**
 * Analytics tracking — POST /analytics/track
 * omnilearn.space | Phase 4
 */

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function track(
  eventType: string,
  payload?: { userId?: string; tenantId?: string; pathId?: string; contentId?: string; [k: string]: unknown }
) {
  fetch(`${API}/analytics/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType, payload: payload ?? {} }),
  }).catch(() => {});
}
