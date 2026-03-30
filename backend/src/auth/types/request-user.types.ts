import { RbacRole } from '../../constants/rbac.constant';
import { UserAccountStatus } from '@prisma/client';

/** Attached to `req.user` after JWT validation. */
export interface RequestUserPayload {
  sub: string;
  email?: string;
  roles: RbacRole[];
  /** Lowercase underscore names, aligned with JWT realm_access.roles */
  rolesRaw: string[];
  permissions: string[];
  tenantId: string | null;
  accountStatus: UserAccountStatus;
  isAdmin: boolean;
}
