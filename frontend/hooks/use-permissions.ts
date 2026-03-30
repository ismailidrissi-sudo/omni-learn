"use client";

import { useMemo } from "react";
import { useUser } from "@/lib/use-user";
import { hasAnyPermission } from "@/lib/permissions";

export function usePermissions() {
  const { user } = useUser();

  const permissions = user?.permissions ?? [];

  const can = useMemo(
    () => (permission: string) => permissions.includes(permission),
    [permissions],
  );

  const hasAny = useMemo(
    () => (list: readonly string[]) => hasAnyPermission(permissions, list),
    [permissions],
  );

  const resolveAdminLabel = useMemo(() => {
    return () => {
      if (permissions.includes("admin:platform")) return "Platform Admin";
      if (permissions.includes("companies:manage")) return "Company Admin";
      if (permissions.includes("company:manage_own") || permissions.includes("users:manage")) {
        return "Company Admin";
      }
      if (permissions.includes("paths:assign")) return "Team Management";
      if (permissions.includes("courses:create") || permissions.includes("courses:update")) {
        return "My Courses";
      }
      if (permissions.includes("moderation:review")) return "Moderation";
      return "Admin";
    };
  }, [permissions]);

  return { permissions, can, hasAny, resolveAdminLabel };
}
