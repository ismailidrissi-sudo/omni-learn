import { BadRequestException } from '@nestjs/common';
import { Prisma, UserType } from '@prisma/client';

export type AudienceScope = 'platform' | 'tenant';

const USER_TYPES: readonly string[] = ['TRAINEE', 'TRAINER', 'COMPANY_ADMIN'];

/**
 * Verified users only; same rules as email campaigns (platform vs tenant).
 */
export function buildVerifiedUserWhere(
  scope: AudienceScope,
  tenantId: string | null,
  targetFilter: Record<string, unknown> | null | undefined,
): Prisma.UserWhereInput {
  const base: Prisma.UserWhereInput = { emailVerified: true };
  const tf = targetFilter || {};
  const ut = tf.userType as string | undefined;
  if (ut && USER_TYPES.includes(ut)) {
    base.userType = ut as UserType;
  }

  if (scope === 'tenant') {
    if (!tenantId) {
      throw new BadRequestException('Tenant scope requires tenantId');
    }
    base.tenantId = tenantId;
    return base;
  }

  const tId = typeof tf.tenantId === 'string' ? tf.tenantId : undefined;
  const all = tf.all === true;
  if (tId) {
    base.tenantId = tId;
  } else if (!all) {
    throw new BadRequestException('Platform audience requires all=true or tenantId');
  }
  return base;
}

export function personalizeEmail(template: string, name: string | null | undefined): string {
  const n = name?.trim() || 'there';
  return template.replace(/\{\{\s*name\s*\}\}/gi, n);
}
