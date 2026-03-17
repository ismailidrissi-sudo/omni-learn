import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService } from '../mailer/mailer.service';
import { RbacRole } from '../constants/rbac.constant';

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
}

@Injectable()
export class AuthService {
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
  ) {
    this.googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }

  /** Sign up with email/password — sends verification email. trainerRequested: user wants to be a trainer (content creator), pending admin approval. */
  async signUp(email: string, password: string, name: string, trainerRequested = false): Promise<{ message: string; userId: string }> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }
    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const token = this.generateVerifyToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const user = await this.prisma.user.create({
      data: {
        email,
        name: name || email.split('@')[0],
        passwordHash,
        emailVerified: false,
        emailVerifyToken: token,
        emailVerifyExpiresAt: expiresAt,
        trainerRequested: !!trainerRequested,
      },
    });

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const verifyUrl = `${baseUrl}/verify-email?token=${token}`;
    await this.mailer.sendVerificationEmail(email, user.name, verifyUrl);

    return { message: 'Verification email sent. Please check your inbox.', userId: user.id };
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

  /** Build JWT roles for a user: admins get every role; others get learner_basic + instructor if approved */
  private getRolesForUser(user: { isAdmin?: boolean; trainerApprovedAt?: Date | null }): string[] {
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
    return roles;
  }

  /** Login with email/password (after verification). Admin accounts (matching ADMIN_EMAIL) are auto-created and auto-verified. */
  async loginWithPassword(email: string, password: string): Promise<{ accessToken: string; user: { id: string; email: string; name: string; profileComplete: boolean; needsProfileCompletion: boolean } }> {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const isAdminLogin = adminEmail && adminPassword
      && email.toLowerCase() === adminEmail.toLowerCase()
      && password === adminPassword;

    if (isAdminLogin) {
      let user = await this.prisma.user.findUnique({ where: { email } });
      const adminData = {
        isAdmin: true,
        trainerRequested: true,
        trainerApprovedAt: new Date(),
        emailVerified: true,
        profileComplete: true,
        planId: 'NEXUS',
      } as any;
      if (!user) {
        const passwordHash = await bcrypt.hash(password, 10);
        user = await this.prisma.user.create({
          data: { email, name: email.split('@')[0], passwordHash, ...adminData },
        });
      } else if (!user.isAdmin || !user.emailVerified) {
        user = await this.prisma.user.update({ where: { id: user.id }, data: adminData });
      }
      const resolved = await this.ensureUserHasTenant(user!);
      const roles = this.getRolesForUser(resolved);
      const accessToken = this.jwtService.sign({
        sub: resolved.id,
        email: resolved.email,
        preferred_username: resolved.email,
        realm_access: { roles },
      });
      return {
        accessToken,
        user: { id: resolved.id, email: resolved.email, name: resolved.name, profileComplete: resolved.profileComplete, needsProfileCompletion: !resolved.profileComplete },
      };
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
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
    const roles = this.getRolesForUser(promoted);
    const accessToken = this.jwtService.sign({
      sub: promoted.id,
      email: promoted.email,
      preferred_username: promoted.email,
      realm_access: { roles },
    });
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
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.emailVerified) {
      return { message: 'If this email exists and is unverified, a new verification link has been sent.' };
    }
    const token = this.generateVerifyToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifyToken: token, emailVerifyExpiresAt: expiresAt },
    });
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const verifyUrl = `${baseUrl}/verify-email?token=${token}`;
    await this.mailer.sendVerificationEmail(email, user.name, verifyUrl);
    return { message: 'If this email exists and is unverified, a new verification link has been sent.' };
  }

  /** Refresh JWT — reissue token with same claims for a valid user (includes instructor if approved trainer) */
  async refreshToken(userId: string): Promise<{ accessToken: string }> {
    const found = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!found) {
      throw new UnauthorizedException('User not found');
    }
    const user = await this.promoteIfAdmin(found);
    const roles = this.getRolesForUser(user);
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      preferred_username: user.email,
      realm_access: { roles },
    });
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
    if (email !== adminEmail || password !== adminPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }
    let user = await this.prisma.user.findUnique({ where: { email } });
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
        data: { email, name: 'Admin User', ...adminData },
      });
    } else if (!user.isAdmin) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: adminData,
      });
    }
    const resolved = await this.ensureUserHasTenant(user!);
    const roles = this.getRolesForUser(resolved);
    const accessToken = this.jwtService.sign({
      sub: resolved.id,
      email: resolved.email,
      preferred_username: resolved.email,
      realm_access: { roles },
    });
    return {
      accessToken,
      user: { id: resolved.id, email: resolved.email, name: resolved.name, profileComplete: resolved.profileComplete, needsProfileCompletion: !resolved.profileComplete },
    };
  }

  /** Verify Google ID token and create/update user, return our JWT */
  async verifyGoogleToken(idToken: string): Promise<{ accessToken: string; user: { id: string; email: string; name: string; profileComplete: boolean; needsProfileCompletion: boolean } }> {
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
    const externalId = `google:${payload.sub}`;
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ externalId }, { email: payload.email }] },
    });
    let resolved: NonNullable<typeof existing>;
    if (!existing) {
      resolved = await this.prisma.user.create({
        data: {
          email: payload.email,
          name: payload.name ?? payload.email.split('@')[0],
          externalId,
          emailVerified: true,
        },
      });
    } else {
      const updates: Record<string, unknown> = {};
      if (!existing.externalId) updates.externalId = externalId;
      if (!existing.emailVerified) updates.emailVerified = true;
      if (Object.keys(updates).length > 0) {
        resolved = await this.prisma.user.update({
          where: { id: existing.id },
          data: updates,
        });
      } else {
        resolved = existing;
      }
    }
    const user = await this.promoteIfAdmin(resolved);
    const roles = this.getRolesForUser(user);
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      preferred_username: user.email,
      realm_access: { roles },
    });
    return {
      accessToken,
      user: { id: user.id, email: user.email, name: user.name, profileComplete: user.profileComplete, needsProfileCompletion: !user.profileComplete },
    };
  }

  /**
   * Exchange LinkedIn authorization code for tokens, fetch profile, and
   * create/update user. Returns our JWT.
   */
  async verifyLinkedInCode(code: string): Promise<{ accessToken: string; linkedinAccessToken: string; user: { id: string; email: string; name: string; profileComplete: boolean; needsProfileCompletion: boolean } }> {
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

    const externalId = `linkedin:${profile.sub}`;
    const displayName = profile.name
      ?? [profile.given_name, profile.family_name].filter(Boolean).join(' ')
      ?? profile.email.split('@')[0];

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ externalId }, { email: profile.email }] },
    });

    let resolved: NonNullable<typeof existing>;
    if (!existing) {
      resolved = await this.prisma.user.create({
        data: {
          email: profile.email,
          name: displayName,
          externalId,
          emailVerified: true,
        },
      });
    } else {
      const updates: Record<string, unknown> = {};
      if (!existing.externalId) updates.externalId = externalId;
      if (!existing.emailVerified) updates.emailVerified = true;
      if (Object.keys(updates).length > 0) {
        resolved = await this.prisma.user.update({
          where: { id: existing.id },
          data: updates,
        });
      } else {
        resolved = existing;
      }
    }

    const user = await this.promoteIfAdmin(resolved);
    const roles = this.getRolesForUser(user);
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      preferred_username: user.email,
      realm_access: { roles },
    });

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

    const externalId = `linkedin:${profile.linkedinId}`;
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ externalId }, { email: profile.email }] },
    });

    let resolved: NonNullable<typeof existing>;
    if (!existing) {
      resolved = await this.prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name ?? profile.email.split('@')[0],
          externalId,
          emailVerified: true,
        },
      });
    } else {
      const updates: Record<string, unknown> = {};
      if (!existing.externalId) updates.externalId = externalId;
      if (!existing.emailVerified) updates.emailVerified = true;
      if (Object.keys(updates).length > 0) {
        resolved = await this.prisma.user.update({
          where: { id: existing.id },
          data: updates,
        });
      } else {
        resolved = existing;
      }
    }

    const user = await this.promoteIfAdmin(resolved);
    const roles = this.getRolesForUser(user);
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      preferred_username: user.email,
      realm_access: { roles },
    });

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
}
