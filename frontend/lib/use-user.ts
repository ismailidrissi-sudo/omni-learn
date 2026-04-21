"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch, refreshTokenQuiet, OMNILEARN_AUTH_CHANGED_EVENT } from "./api";

export type UserPlan = "EXPLORER" | "SPECIALIST" | "VISIONARY" | "NEXUS";

export interface User {
  id: string;
  email: string;
  name: string;
  planId: UserPlan;
  /** Plan used for catalog/content access when an approved academy member (tenant.settings.plan). */
  effectivePlanId?: UserPlan;
  orgApprovalStatus?: string | null;
  billingCycle?: string | null;
  sectorFocus?: string | null;
  tenantId?: string | null;
  isAdmin?: boolean;
  trainerRequested?: boolean;
  trainerApprovedAt?: string | null;
  permissions?: string[];
  roles?: string[];
  accountStatus?: string;
  country?: string | null;
  city?: string | null;
  countryCode?: string | null;
  timezone?: string | null;
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
  const lastGoodUserRef = useRef<User | null>(null);

  const loadUser = useCallback(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("omnilearn_token");
    if (!token) {
      lastGoodUserRef.current = null;
      setUser(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    apiFetch("/auth/me")
      .then(async (r) => {
        if (r.ok) {
          const profile = (await r.json()) as User;
          lastGoodUserRef.current = profile;
          if (profile.trainerApprovedAt || profile.isAdmin) {
            const roles = getJwtRoles();
            if (!roles.includes("instructor")) {
              await refreshTokenQuiet();
            }
          }
          return { kind: "ok" as const, profile };
        }
        if (r.status >= 500 || r.status === 429) {
          return { kind: "transient" as const };
        }
        return { kind: "fail" as const };
      })
      .catch(() => ({ kind: "transient" as const }))
      .then((out) => {
        if (out.kind === "ok") setUser(out.profile);
        else if (out.kind === "fail") {
          lastGoodUserRef.current = null;
          setUser(null);
        } else {
          setUser(lastGoodUserRef.current);
        }
      })
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
