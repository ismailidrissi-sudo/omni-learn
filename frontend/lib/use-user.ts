"use client";

import { useState, useEffect } from "react";
import { apiFetch, refreshTokenQuiet } from "./api";

export type UserPlan = "EXPLORER" | "SPECIALIST" | "VISIONARY" | "NEXUS";

export interface User {
  id: string;
  email: string;
  name: string;
  planId: UserPlan;
  billingCycle?: string | null;
  sectorFocus?: string | null;
  tenantId?: string | null;
  isAdmin?: boolean;
  trainerRequested?: boolean;
  trainerApprovedAt?: string | null;
}

function getJwtRoles(): string[] {
  try {
    const token = localStorage.getItem("omnilearn_token");
    if (!token) return [];
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.realm_access?.roles ?? [];
  } catch {
    return [];
  }
}

export function useUser(): { user: User | null; loading: boolean } {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") {
      setLoading(false);
      return;
    }
    const token = localStorage.getItem("omnilearn_token");
    if (!token) {
      setLoading(false);
      return;
    }
    apiFetch("/auth/me")
      .then((r) => {
        if (r.ok) return r.json();
        return null;
      })
      .then(async (profile: User | null) => {
        if (profile && (profile.trainerApprovedAt || profile.isAdmin)) {
          const roles = getJwtRoles();
          if (!roles.includes("instructor")) {
            await refreshTokenQuiet();
          }
        }
        setUser(profile);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  return { user, loading };
}
