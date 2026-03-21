"use client";

import { useSessionTracking } from "@/hooks/use-session-tracking";

export function SessionTracker() {
  useSessionTracking();
  return null;
}
