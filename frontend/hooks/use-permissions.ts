"use client";

import { useMemo } from "react";
import { useUser } from "@/lib/use-user";
import { useI18n } from "@/lib/i18n/context";
import { hasAnyPermission } from "@/lib/permissions";

export function usePermissions() {
  const { user, loading } = useUser();
  const { t } = useI18n();

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
      if (permissions.includes("admin:platform")) return t("admin.platformAdmin");
      if (permissions.includes("companies:manage")) return t("admin.companyAdminRole");
      if (permissions.includes("company:manage_own") || permissions.includes("users:manage")) {
        return t("admin.companyAdminRole");
      }
      if (permissions.includes("paths:assign")) return t("admin.teamManagement");
      if (permissions.includes("courses:create") || permissions.includes("courses:update")) {
        return t("admin.myCourses");
      }
      if (permissions.includes("moderation:review")) return t("admin.moderation");
      return t("admin.shellTitle");
    };
  }, [permissions, t]);

  return { permissions, can, hasAny, resolveAdminLabel, loading };
}
