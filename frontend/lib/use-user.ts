"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch, refreshTokenQuiet, OMNILEARN_AUTH_CHANGED_EVENT } from "./api";

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

  const loadUser = useCallback(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("omnilearn_token");
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    setLoading(true);
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

  useEffect(() => {
    if (typeof window === "undefined") {
      setLoading(false);
      return;
    }

    loadUser();

    const onAuthChanged = () => loadUser();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "omnilearn_token" || e.key === null) loadUser();
    };

    window.addEventListener(OMNILEARN_AUTH_CHANGED_EVENT, onAuthChanged);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(OMNILEARN_AUTH_CHANGED_EVENT, onAuthChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, [loadUser]);

  return { user, loading };
}
