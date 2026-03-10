import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService } from '../mailer/mailer.service';
import { RbacRole } from '../constants/rbac.constant';

/**
 * Auth Service — Keycloak SSO + Google Sign-In + Multi-tenant RBAC
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

  /** Sign up with email/password — sends verification email */
  async signUp(email: string, password: string, name: string): Promise<{ message: string; userId: string }> {
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
      },
    });

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const verifyUrl = `${baseUrl}/verify-email?token=${token}`;
    await this.mailer.sendVerificationEmail(email, user.name, verifyUrl);

    return { message: 'Verification email sent. Please check your inbox.', userId: user.id };
  }

  /** Login with email/password (after verification) */
  async loginWithPassword(email: string, password: string): Promise<{ accessToken: string; user: { id: string; email: string; name: string } }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.emailVerified) {
      throw new UnauthorizedException('Please verify your email before signing in');
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      preferred_username: user.email,
      realm_access: { roles: ['learner_basic'] },
    });
    return {
      accessToken,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  private generateVerifyToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
  /** Map Keycloak realm roles to our RBAC roles */
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
  async devLogin(email: string, password: string): Promise<{ accessToken: string; user: { id: string; email: string; name: string } }> {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminEmail || !adminPassword) {
      throw new UnauthorizedException('Dev login not configured (ADMIN_EMAIL, ADMIN_PASSWORD)');
    }
    if (email !== adminEmail || password !== adminPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }
    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await this.prisma.user.create({
        data: { email, name: 'Admin User' },
      });
    }
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      preferred_username: user.email,
      realm_access: { roles: ['super_admin'] },
    });
    return {
      accessToken,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  /** Verify Google ID token and create/update user, return our JWT */
  async verifyGoogleToken(idToken: string): Promise<{ accessToken: string; user: { id: string; email: string; name: string } }> {
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
    let user = await this.prisma.user.findFirst({
      where: { OR: [{ externalId }, { email: payload.email }] },
    });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: payload.email,
          name: payload.name ?? payload.email.split('@')[0],
          externalId,
        },
      });
    } else if (!user.externalId) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { externalId },
      });
    }
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      preferred_username: user.email,
      realm_access: { roles: ['learner_basic'] },
    });
    return {
      accessToken,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }
}
