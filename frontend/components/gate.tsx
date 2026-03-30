"use client";

import type { ReactNode } from "react";
import { usePermissions } from "@/hooks/use-permissions";

type GateProps = {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
};

/** UI-only visibility; enforcement is on the API. */
export function Gate({ permission, children, fallback = null }: GateProps) {
  const { can } = usePermissions();
  if (!can(permission)) return fallback;
  return children;
}

type GateAnyProps = {
  anyOf: readonly string[];
  children: ReactNode;
  fallback?: ReactNode;
};

export function GateAny({ anyOf, children, fallback = null }: GateAnyProps) {
  const { hasAny } = usePermissions();
  if (!hasAny(anyOf)) return fallback;
  return children;
}
