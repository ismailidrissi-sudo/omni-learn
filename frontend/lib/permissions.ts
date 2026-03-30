/** Must stay in sync with backend ROLE_PERMISSIONS / admin entry checks. */
export const ADMIN_NAV_ANY_PERMISSIONS = [
  "domains:create",
  "domains:update",
  "paths:create",
  "paths:assign",
  "courses:create",
  "courses:update",
  "users:manage",
  "companies:manage",
  "admin:smtp",
  "admin:analytics",
  "moderation:review",
  "approvals:review",
  "admin:platform",
  "company:manage_own",
  "media:manage",
] as const;

export function hasAnyPermission(
  granted: readonly string[] | undefined,
  required: readonly string[],
): boolean {
  if (!granted?.length) return false;
  const set = new Set(granted);
  return required.some((p) => set.has(p));
}

export function parsePermissionsFromToken(token: string | undefined): string[] {
  if (!token) return [];
  try {
    const part = token.split(".")[1];
    if (!part) return [];
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as { omnilearn_permissions?: string[] };
    return Array.isArray(payload.omnilearn_permissions)
      ? payload.omnilearn_permissions
      : [];
  } catch {
    return [];
  }
}
