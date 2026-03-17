"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "./api";

export type UserPlan = "EXPLORER" | "SPECIALIST" | "VISIONARY" | "NEXUS";

export type RbacRole = 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'COMPANY_MANAGER' | 'INSTRUCTOR' | 'CONTENT_MODERATOR' | 'LEARNER_PRO' | 'LEARNER_BASIC';

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
  roles?: RbacRole[];
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
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  return { user, loading };
}
