import { RbacRole } from '../constants/rbac.constant';

/** Granular capabilities — UI and PermissionGuard use these, not raw role names. */
export const ROLE_PERMISSIONS: Record<RbacRole, readonly string[]> = {
  [RbacRole.SUPER_ADMIN]: [
    'admin:platform',
    'domains:create',
    'domains:update',
    'paths:create',
    'paths:assign',
    'paths:update',
    'courses:create',
    'courses:update',
    'courses:edit_any',
    'users:manage',
    'users:view_map',
    'companies:manage',
    'admin:smtp',
    'admin:analytics',
    'admin:settings',
    'moderation:review',
    'approvals:review',
    'approvals:review_all',
    'approvals:action',
    'ai:manage_keys',
    'media:manage',
  ],
  [RbacRole.COMPANY_ADMIN]: [
    'domains:create',
    'domains:update',
    'paths:create',
    'paths:assign',
    'paths:update',
    'courses:create',
    'courses:update',
    'courses:edit_own',
    'users:manage',
    'users:view_map',
    'company:manage_own',
    'company:manage_branding',
    'company:manage_users',
    'company:accept_join',
    'approvals:review',
    'approvals:action',
    'media:manage',
  ],
  [RbacRole.COMPANY_MANAGER]: ['paths:assign', 'users:view_map', 'company:team_reports'],
  [RbacRole.INSTRUCTOR]: ['courses:create', 'courses:update', 'courses:edit_own', 'media:manage'],
  [RbacRole.CONTENT_MODERATOR]: ['moderation:review'],
  [RbacRole.LEARNER_PRO]: [],
  [RbacRole.LEARNER_BASIC]: [],
};

export function resolvePermissionsFromRoles(roles: RbacRole[]): string[] {
  const set = new Set<string>();
  for (const role of roles) {
    const list = ROLE_PERMISSIONS[role];
    if (list) for (const p of list) set.add(p);
  }
  return [...set].sort();
}
