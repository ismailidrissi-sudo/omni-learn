import { SetMetadata } from '@nestjs/common';
import { RbacRole } from '../../constants/rbac.constant';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: RbacRole[]) => SetMetadata(ROLES_KEY, roles);
