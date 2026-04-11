import { Injectable, UnauthorizedException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import Redis from 'ioredis';
import {
  ApprovalRequestType,
  OrgApprovalStatus,
  SubscriptionPlan,
  UserAccountStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionalEmailService } from '../email/transactional-email.service';
import { RbacRole } from '../constants/rbac.constant';
import { resolvePermissionsFromRoles } from './permissions.constants';
import type { RequestUserPayload } from './types/request-user.types';

/**
 * Auth Service — Keycloak SSO + Google Sign-In + LinkedIn Sign-In + Multi-tenant RBAC
 * omnilearn.space | Afflatus Consulting Group
 */

export interface JwtPayload {
  sub: string;
  email?: string;
  realm_access?: { roles: string[] };
  resource_access?: Record<string, { roles: string[] }>;
  tenant_id?: string;
  preferred_username?: string;
  omnilearn_permissions?: string[];
  /** Unix seconds — used by refresh flow with ignoreExpiration */
  exp?: number;
}

@Injectable()
export class AuthService {
  private readonly log = new Logger(AuthService.name);
  private readonly googleClient: OAuth2Client;
  private redis: Redis | null = null;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly transactionalEmail: TransactionalEmailService,
  ) {
    this.googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    this.initRedis();
  }

  private initRedis() {
    if (process.env.REDIS_DISABLED === 'true') return;
    try {
      const url = process.env.REDIS_URL;
      this.redis = url
        ? new Redis(url, { maxRetriesPerRequest: null })
        : new Redis({
            host: process.env.REDIS_HOST ?? '127.0.0.1',
            port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
            password: process.env.REDIS_PASSWORD || undefined,
            maxRetriesPerRequest: null,
          });
      this.redis.on('error', (e) => this.log.warn(`Redis: ${e.message}`));
    } catch {
      this.redis = null;
    }
  }

  /** Rate limit check via Redis sorted set with sliding window. Returns true if allowed. */
  private async isRateLimited(key: string, maxRequests: number, windowMs: number): Promise<boolean> {
    if (!this.redis) return false;
    try {
      const now = Date.now();
      const windowStart = now - windowMs;
      await this.redis.zremrangebyscore(key, '-inf', windowStart);
      const count = await this.redis.zcard(key);
      if (count >= maxRequests) return true;
      await this.redis.zadd(key, now, `${now}:${Math.random()}`);
      await this.redis.pexpire(key, windowMs);
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Sign up with email/password — sends verification email.
   * Optional `tenantSlug`: join branded academy with org approval pending after verification.
   */
  async signUp(
    email: string,
    password: string,
    name: string,
    trainerRequested = false,
    tenantSlug?: string,
    requestedPlan: SubscriptionPlan = SubscriptionPlan.EXPLORER,
  ): Promise<{ message: string; userId: string }> {
    const emailNorm = email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email: emailNorm } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }
    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    let tenantId: string | undefined;
    let orgStatus: OrgApprovalStatus = OrgApprovalStatus.NONE;
    let accountStatus: UserAccountStatus = UserAccountStatus.ACTIVE;
    if (tenantSlug) {
      const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (!tenant) {
        throw new BadRequestException('Unknown academy');
      }
      tenantId = tenant.id;
      orgStatus = OrgApprovalStatus.PENDING;
      accountStatus = UserAccountStatus.PENDING_COMPANY;
    }

    const paidPlan = requestedPlan !== SubscriptionPlan.EXPLORER;
    if (paidPlan && !tenantSlug) {
      accountStatus = UserAccountStatus.PENDING_PLAN;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const rawVerifyToken = this.generateVerifyToken();
    const verifyTokenHash = crypto.createHash('sha256').update(rawVerifyToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const user = await this.prisma.user.create({
      data: {
        email: emailNorm,
        name: name || email.split('@')[0],
        passwordHash,
        emailVerified: false,
        emailVerifyToken: verifyTokenHash,
        emailVerifyExpiresAt: expiresAt,
        trainerRequested: !!trainerRequested,
        tenantId,
        orgApprovalStatus: orgStatus,
        accountStatus,
        planId: paidPlan && !tenantSlug ? requestedPlan : SubscriptionPlan.EXPLORER,
      },
    });

    const platformTenant =
      (await this.prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } })) ?? undefined;
    if (paidPlan && !tenantSlug && platformTenant) {
      await this.prisma.approvalRequest.create({
        data: {
          tenantId: platformTenant.id,
          type: ApprovalRequestType.PLAN_UPGRADE,
          requesterId: user.id,
          payload: { requested_plan: requestedPlan },
        },
      });
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail) {
        this.transactionalEmail
          .sendPlanApprovalPendingAdmin({
            toEmail: adminEmail,
            userName: user.name,
            userEmail: user.email,
            plan: requestedPlan,
          })
          .catch(() => undefined);
      }
    }
    if (tenantSlug && tenantId) {
      await this.prisma.approvalRequest.create({
        data: {
          tenantId,
          type: ApprovalRequestType.COMPANY_JOIN,
          requesterId: user.id,
          payload: { company_tenant_id: tenantId, message: '' },
        },
      });
    }

    await this.transactionalEmail.sendEmailVerification({
      toEmail: emailNorm,
      toName: user.name,
      userId: user.id,
      verifyToken: rawVerifyToken,
    });

    return { message: 'Verification email sent. Please check your inbox.', userId: user.id };
  }

  /** Always returns generic message (no email enumeration). Max 3 requests per email per hour. */
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const generic = { message: 'If this email exists, a reset link has been sent.' };
    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: normalized, mode: 'insensitive' } },
    });
    if (!user?.passwordHash) {
      return generic;
    }
    const rateLimited = await this.isRateLimited(`ratelimit:pwreset:${normalized}`, 3, 3600_000);
    if (rateLimited) {
      return generic;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const passwordResetTokenHash = await bcrypt.hash(rawToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash,
        passwordResetExpiresAt: new Date(Date.now() + 3600_000),
      },
    });

    await this.transactionalEmail.sendPasswordResetRequest({
      toEmail: user.email,
      toName: user.name,
      userId: user.id,
      rawToken,
    });

    return generic;
  }

  async confirmPasswordReset(email: string, token: string, newPassword: string): Promise<{ message: string }> {
    if (newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email.trim(), mode: 'insensitive' } },
    });
    if (!user?.passwordResetTokenHash || !user.passwordResetExpiresAt) {
      throw new BadRequestException('Invalid or expired reset link');
    }
    if (user.passwordResetExpiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset link');
    }
    const match = await bcrypt.compare(token, user.passwordResetTokenHash);
    if (!match) {
      throw new BadRequestException('Invalid or expired reset link');
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        emailVerifyToken: null,
        emailVerifyExpiresAt: null,
      },
    });
    await this.transactionalEmail.sendPasswordResetSuccess({
      userId: user.id,
      toEmail: user.email,
      toName: user.name,
    });
    return { message: 'Password updated. You can sign in with your new password.' };
  }

  /** Auto-promote user to admin if their email matches ADMIN_EMAIL env var */
  private async promoteIfAdmin<T extends { id: string; email: string; isAdmin?: boolean; tenantId?: string | null }>(user: T): Promise<T> {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail && user.email.toLowerCase() === adminEmail.toLowerCase() && !user.isAdmin) {
      const promoted = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          isAdmin: true,
          trainerRequested: true,
          trainerApprovedAt: new Date(),
          emailVerified: true,
          profileComplete: true,
          planId: 'NEXUS',
        } as any,
      });
      const withTenant = await this.ensureUserHasTenant(promoted);
      return withTenant as unknown as T;
    }
    if (user.isAdmin && !user.tenantId) {
      const withTenant = await this.ensureUserHasTenant(user as any);
      return withTenant as unknown as T;
    }
    return user;
  }

  /** Ensure a user is assigned to a tenant. Finds the first existing tenant or creates a default one. */
  private async ensureUserHasTenant<T extends { id: string; tenantId?: string | null }>(user: T): Promise<T> {
    if (user.tenantId) return user;
    let tenant = await this.prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!tenant) {
      tenant = await this.prisma.tenant.create({
        data: { name: 'OmniLearn', slug: 'omnilearn' },
      });
    }
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { tenantId: tenant.id },
    });
    return updated as unknown as T;
  }

  /** Build JWT roles for a user: admins get every role; others get learner_basic + instructor/company_admin if approved */
  private getRolesForUser(user: {
    isAdmin?: boolean | null;
    trainerApprovedAt?: Date | null;
    companyAdminApprovedAt?: Date | null;
  }): string[] {
    if (user?.isAdmin) {
      return [
        'super_admin',
        'company_admin',
        'company_manager',
        'instructor',
        'content_moderator',
        'learner_pro',
        'learner_basic',
      ];
    }
    const roles = ['learner_basic'];
    if (user?.trainerApprovedAt) {
      roles.push('instructor');
    }
    if (user?.companyAdminApprovedAt) {
      roles.push('company_admin');
    }
    return roles;
  }

  private signAccessToken(user: {
    id: string;
    email: string;
    isAdmin?: boolean | null | undefined;
    trainerApprovedAt?: Date | null;
    companyAdminApprovedAt?: Date | null;
  }): string {
    const rolesRaw = this.getRolesForUser(user);
    const roles: RbacRole[] = [];
    for (const r of rolesRaw) {
      const mapped = this.mapKeycloakRoleToRbac(r);
      if (mapped && !roles.includes(mapped)) roles.push(mapped);
    }
    const permissions = resolvePermissionsFromRoles(roles);
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      preferred_username: user.email,
      realm_access: { roles: rolesRaw },
      omnilearn_permissions: permissions,
    });
  }

  /** Login with email/password (after verification). Admin accounts (matching ADMIN_EMAIL) are auto-created and auto-verified. */
  async loginWithPassword(email: string, password: string): Promise<{ accessToken: string; user: { id: string; email: string; name: string; profileComplete: boolean; needsProfileCompletion: boolean } }> {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const isAdminLogin = adminEmail && adminPassword
      && email.toLowerCase() === adminEmail.toLowerCase()
      && password === adminPassword;

    if (isAdminLogin) {
      let user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
      const adminData = {
        isAdmin: true,
        trainerRequested: true,
        trainerApprovedAt: new Date(),
        emailVerified: true,
        profileComplete: true,
        planId: 'NEXUS',
      } as any;
      if (!user) {
        const emailLower = email.toLowerCase().trim();
        const passwordHash = await bcrypt.hash(password, 10);
        user = await this.prisma.user.create({
          data: { email: emailLower, name: emailLower.split('@')[0], passwordHash, ...adminData },
        });
      } else if (!user.isAdmin || !user.emailVerified) {
        user = await this.prisma.user.update({ where: { id: user.id }, data: adminData });
      }
      const resolved = await this.ensureUserHasTenant(user!);
      const accessToken = this.signAccessToken(resolved);
      return {
        accessToken,
        user: { id: resolved.id, email: resolved.email, name: resolved.name, profileComplete: resolved.profileComplete, needsProfileCompletion: !resolved.profileComplete },
      };
    }

    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email.trim(), mode: 'insensitive' } },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.passwordHash) {
      const provider = user.externalId?.startsWith('google:') ? 'Google'
        : user.externalId?.startsWith('linkedin:') ? 'LinkedIn' : 'social login';
      throw new UnauthorizedException(`This account uses ${provider}. Please sign in with ${provider} instead.`);
    }
    if (!user.emailVerified) {
      throw new UnauthorizedException('Please verify your email before signing in');
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const promoted = await this.promoteIfAdmin(user);
    const accessToken = this.signAccessToken(promoted);
    return {
      accessToken,
      user: { id: promoted.id, email: promoted.email, name: promoted.name, profileComplete: promoted.profileComplete, needsProfileCompletion: !promoted.profileComplete },
    };
  }

  private generateVerifyToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /** Resend email verification link for unverified accounts */
  async resendVerification(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email.trim(), mode: 'insensitive' } },
    });
    if (!user || user.emailVerified) {
      return { message: 'If this email exists and is unverified, a new verification link has been sent.' };
    }
    const rawVerifyToken = this.generateVerifyToken();
    const verifyTokenHash = crypto.createHash('sha256').update(rawVerifyToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifyToken: verifyTokenHash, emailVerifyExpiresAt: expiresAt },
    });
    await this.transactionalEmail.sendEmailVerification({
      toEmail: user.email,
      toName: user.name,
      userId: user.id,
      verifyToken: rawVerifyToken,
    });
    return { message: 'If this email exists and is unverified, a new verification link has been sent.' };
  }

  /** Refresh JWT — reissue token with same claims for a valid user (includes instructor if approved trainer) */
  async refreshToken(userId: string): Promise<{ accessToken: string }> {
    const found = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!found) {
      throw new UnauthorizedException('User not found');
    }
    if (found.accountStatus === UserAccountStatus.SUSPENDED) {
      throw new UnauthorizedException('Account is suspended');
    }
    const user = await this.promoteIfAdmin(found);
    const accessToken = this.signAccessToken(user);
    return { accessToken };
  }

  mapKeycloakRoleToRbac(keycloakRole: string): RbacRole | null {
    const mapping: Record<string, RbacRole> = {
      super_admin: RbacRole.SUPER_ADMIN,
      company_admin: RbacRole.COMPANY_ADMIN,
      company_manager: RbacRole.COMPANY_MANAGER,
      instructor: RbacRole.INSTRUCTOR,
      content_moderator: RbacRole.CONTENT_MODERATOR,
      learner_pro: RbacRole.LEARNER_PRO,
      learner_basic: RbacRole.LEARNER_BASIC,
    };
    return mapping[keycloakRole.toLowerCase()] ?? null;
  }

  /**
   * Shared OAuth user resolution: find by externalId or email, create if new, update if needed.
   * Normalizes email to lowercase. Returns the resolved user and whether they are new.
   */
  private async resolveOrCreateOAuthUser(
    externalId: string,
    email: string,
    name: string,
  ): Promise<{ user: NonNullable<Awaited<ReturnType<typeof this.prisma.user.findFirst>>>; isNewUser: boolean }> {
    const emailNorm = email.toLowerCase().trim();
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ externalId }, { email: emailNorm }] },
    });

    if (!existing) {
      const created = await this.prisma.user.create({
        data: {
          email: emailNorm,
          name: name || emailNorm.split('@')[0],
          externalId,
          emailVerified: true,
        },
      });
      return { user: created, isNewUser: true };
    }

    const updates: Record<string, unknown> = {};
    if (!existing.externalId) updates.externalId = externalId;
    if (!existing.emailVerified) updates.emailVerified = true;
    if (Object.keys(updates).length > 0) {
      const updated = await this.prisma.user.update({
        where: { id: existing.id },
        data: updates,
      });
      return { user: updated, isNewUser: false };
    }
    return { user: existing, isNewUser: false };
  }

  /** Extract RBAC roles from JWT payload (Keycloak format) */
  getRolesFromPayload(payload: JwtPayload): RbacRole[] {
    const roles: RbacRole[] = [];
    const realmRoles = payload.realm_access?.roles ?? [];
    const clientRoles = Object.values(payload.resource_access ?? {}).flatMap((r) => r.roles ?? []);

    for (const r of [...realmRoles, ...clientRoles]) {
      const mapped = this.mapKeycloakRoleToRbac(r);
      if (mapped && !roles.includes(mapped)) roles.push(mapped);
    }

    return roles;
  }

  /** Get tenant ID from JWT (Keycloak custom claim or resource) */
  getTenantId(payload: JwtPayload): string | null {
    return payload.tenant_id ?? null;
  }

  /** Dev-only: Login with email/password, return JWT with admin role */
  async devLogin(email: string, password: string): Promise<{ accessToken: string; user: { id: string; email: string; name: string; profileComplete: boolean; needsProfileCompletion: boolean } }> {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminEmail || !adminPassword) {
      throw new UnauthorizedException('Dev login not configured (ADMIN_EMAIL, ADMIN_PASSWORD)');
    }
    if (email.toLowerCase().trim() !== adminEmail.toLowerCase().trim() || password !== adminPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const emailLower = email.toLowerCase().trim();
    let user = await this.prisma.user.findUnique({ where: { email: emailLower } });
    const adminData = {
      isAdmin: true,
      trainerRequested: true,
      trainerApprovedAt: new Date(),
      emailVerified: true,
      profileComplete: true,
      planId: 'NEXUS',
    } as any;
    if (!user) {
      user = await this.prisma.user.create({
        data: { email: emailLower, name: 'Admin User', ...adminData },
      });
    } else if (!user.isAdmin) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: adminData,
      });
    }
    const resolved = await this.ensureUserHasTenant(user!);
    const accessToken = this.signAccessToken(resolved);
    return {
      accessToken,
      user: { id: resolved.id, email: resolved.email, name: resolved.name, profileComplete: resolved.profileComplete, needsProfileCompletion: !resolved.profileComplete },
    };
  }

  /** Verify Google ID token and create/update user, return our JWT */
  async verifyGoogleToken(idToken: string): Promise<{
    accessToken: string;
    user: { id: string; email: string; name: string; profileComplete: boolean; needsProfileCompletion: boolean };
    isNewUser: boolean;
  }> {
    if (!process.env.GOOGLE_CLIENT_ID) {
      throw new UnauthorizedException('Google Sign-In not configured (GOOGLE_CLIENT_ID)');
    }
    const ticket = await this.googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload?.email) {
      throw new UnauthorizedException('Invalid Google token');
    }
    const { user: resolved, isNewUser } = await this.resolveOrCreateOAuthUser(
      `google:${payload.sub}`,
      payload.email,
      payload.name ?? payload.email.split('@')[0],
    );
    const user = await this.promoteIfAdmin(resolved);
    const accessToken = this.signAccessToken(user);
    return {
      accessToken,
      user: { id: user.id, email: user.email, name: user.name, profileComplete: user.profileComplete, needsProfileCompletion: !user.profileComplete },
      isNewUser,
    };
  }

  /**
   * Exchange LinkedIn authorization code for tokens, fetch profile, and
   * create/update user. Returns our JWT.
   */
  async verifyLinkedInCode(code: string): Promise<{
    accessToken: string;
    linkedinAccessToken: string;
    user: { id: string; email: string; name: string; profileComplete: boolean; needsProfileCompletion: boolean };
    isNewUser: boolean;
  }> {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    const redirectUri = process.env.LINKEDIN_CALLBACK_URL || 'http://localhost:3000/auth/linkedin/callback';

    if (!clientId || !clientSecret) {
      throw new UnauthorizedException('LinkedIn Sign-In not configured (LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET)');
    }

    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text();
      throw new UnauthorizedException(`LinkedIn token exchange failed: ${err}`);
    }

    const tokens = (await tokenResponse.json()) as {
      access_token: string;
      expires_in: number;
      id_token?: string;
    };

    const profileResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!profileResponse.ok) {
      throw new UnauthorizedException('Failed to fetch LinkedIn profile');
    }

    const profile = (await profileResponse.json()) as {
      sub: string;
      email?: string;
      name?: string;
      given_name?: string;
      family_name?: string;
      picture?: string;
    };

    if (!profile.sub || !profile.email) {
      throw new UnauthorizedException('LinkedIn profile missing required fields (sub, email)');
    }

    const displayName = profile.name
      ?? [profile.given_name, profile.family_name].filter(Boolean).join(' ')
      ?? profile.email.split('@')[0];

    const { user: resolved, isNewUser } = await this.resolveOrCreateOAuthUser(
      `linkedin:${profile.sub}`,
      profile.email,
      displayName,
    );
    const user = await this.promoteIfAdmin(resolved);
    const accessToken = this.signAccessToken(user);

    return {
      accessToken,
      linkedinAccessToken: tokens.access_token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        profileComplete: user.profileComplete,
        needsProfileCompletion: !user.profileComplete,
      },
      isNewUser,
    };
  }

  /**
   * Handle the Passport-callback flow: profile already resolved by LinkedInStrategy.
   */
  async loginWithLinkedInProfile(profile: {
    linkedinId: string;
    email?: string;
    name?: string;
    accessToken: string;
  }): Promise<{ accessToken: string; linkedinAccessToken: string; user: { id: string; email: string; name: string; profileComplete: boolean; needsProfileCompletion: boolean } }> {
    if (!profile.email) {
      throw new UnauthorizedException('LinkedIn account has no email');
    }

    const { user: resolved } = await this.resolveOrCreateOAuthUser(
      `linkedin:${profile.linkedinId}`,
      profile.email,
      profile.name ?? profile.email.split('@')[0],
    );
    const user = await this.promoteIfAdmin(resolved);
    const accessToken = this.signAccessToken(user);

    return {
      accessToken,
      linkedinAccessToken: profile.accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        profileComplete: user.profileComplete,
        needsProfileCompletion: !user.profileComplete,
      },
    };
  }

  /**
   * Redeem a magic link invite token: validates hash + expiry, issues JWT.
   * Clears the token after successful redemption (one-time use).
   */
  async redeemMagicLink(
    email: string,
    rawToken: string,
  ): Promise<{
    accessToken: string;
    user: { id: string; email: string; name: string; profileComplete: boolean; needsProfileCompletion: boolean };
  }> {
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email.trim().toLowerCase(), mode: 'insensitive' } },
    });
    if (!user?.magicLinkTokenHash || !user.magicLinkExpiresAt) {
      throw new UnauthorizedException('Invalid or expired invitation link');
    }
    if (user.magicLinkExpiresAt < new Date()) {
      throw new UnauthorizedException('This invitation link has expired. Please ask your administrator to send a new one.');
    }
    const match = await bcrypt.compare(rawToken, user.magicLinkTokenHash);
    if (!match) {
      throw new UnauthorizedException('Invalid or expired invitation link');
    }

    // Atomically clear the token so concurrent redemptions cannot both succeed
    const claimed = await this.prisma.user.updateMany({
      where: { id: user.id, magicLinkTokenHash: { not: null } },
      data: {
        magicLinkTokenHash: null,
        magicLinkExpiresAt: null,
        emailVerified: true,
      },
    });
    if (claimed.count === 0) {
      throw new UnauthorizedException('This invitation link has already been used');
    }

    const fresh = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const accessToken = this.signAccessToken(fresh);
    return {
      accessToken,
      user: {
        id: fresh.id,
        email: fresh.email,
        name: fresh.name,
        profileComplete: fresh.profileComplete,
        needsProfileCompletion: !fresh.profileComplete,
      },
    };
  }

  /**
   * Full auth context from DB (roles + permissions). Used by JWT strategy and GET /auth/me.
   */
  async loadRequestUser(userId: string): Promise<RequestUserPayload | null> {
    const found = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!found) return null;
    const user = await this.promoteIfAdmin(found);
    const rolesRaw = this.getRolesForUser(user);
    const roles: RbacRole[] = [];
    for (const r of rolesRaw) {
      const mapped = this.mapKeycloakRoleToRbac(r);
      if (mapped && !roles.includes(mapped)) roles.push(mapped);
    }
    const permissions = resolvePermissionsFromRoles(roles);
    return {
      sub: user.id,
      email: user.email,
      roles,
      rolesRaw,
      permissions,
      tenantId: user.tenantId ?? null,
      accountStatus: user.accountStatus,
      isAdmin: !!user.isAdmin,
    };
  }
}
