import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RbacGuard } from '../auth/guards/rbac.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RbacRole } from '../constants/rbac.constant';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUserPayload } from '../auth/types/request-user.types';
import { PrismaService } from '../prisma/prisma.service';
import { SeatLimitService } from './seat-limit.service';
import { TransactionalEmailService } from '../email/transactional-email.service';
import { OrgApprovalStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const MAGIC_LINK_TTL_HOURS = 48;

interface BulkInviteDto {
  tenantId: string;
  emails: string[];
}

interface BulkImportDto {
  tenantId: string;
  users: { name: string; email: string; role?: string }[];
}

@Controller('company')
export class UserManagementController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seatLimit: SeatLimitService,
    private readonly transactionalEmail: TransactionalEmailService,
  ) {}

  // ── Magic Link Bulk Invite (email-only) ────────────────────────────────

  @Post('users/bulk-invite')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  async bulkInvite(
    @Body() body: BulkInviteDto,
    @CurrentUser() actor: RequestUserPayload,
  ) {
    if (!body.tenantId || !Array.isArray(body.emails) || body.emails.length === 0) {
      throw new BadRequestException('tenantId and emails array are required');
    }
    if (body.emails.length > 500) {
      throw new BadRequestException('Maximum 500 invites per batch');
    }

    this.assertTenantScope(actor, body.tenantId);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: body.tenantId },
      select: { id: true, name: true, slug: true },
    });
    if (!tenant) throw new BadRequestException('Tenant not found');

    const normalized = body.emails
      .map((e) => e.toLowerCase().trim())
      .filter((e) => e.includes('@'));

    const unique = [...new Set(normalized)];

    const existingEmails = new Set(
      (
        await this.prisma.user.findMany({
          where: { email: { in: unique } },
          select: { email: true },
        })
      ).map((u) => u.email.toLowerCase()),
    );

    const newEmails = unique.filter((e) => !existingEmails.has(e));
    if (newEmails.length === 0) {
      return { invited: 0, skipped: unique.length, total: body.emails.length };
    }

    const pendingEmails: Array<{ email: string; userId: string; rawToken: string }> = [];

    const result = await this.prisma.$transaction(async (tx) => {
      await this.seatLimit.assertSeatAvailable(body.tenantId, newEmails.length, tx);

      let invited = 0;
      for (const email of newEmails) {
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = await bcrypt.hash(rawToken, 10);
        const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_HOURS * 60 * 60 * 1000);

        const user = await tx.user.create({
          data: {
            email,
            name: email.split('@')[0],
            tenantId: body.tenantId,
            emailVerified: true,
            profileComplete: false,
            orgApprovalStatus: OrgApprovalStatus.APPROVED,
            magicLinkTokenHash: tokenHash,
            magicLinkExpiresAt: expiresAt,
          },
        });

        pendingEmails.push({ email, userId: user.id, rawToken });
        invited++;
      }
      return invited;
    });

    for (const pe of pendingEmails) {
      this.transactionalEmail
        .sendMagicLinkInvite({
          toEmail: pe.email,
          userId: pe.userId,
          academyName: tenant.name,
          tenantSlug: tenant.slug,
          rawToken: pe.rawToken,
          expiresInHours: MAGIC_LINK_TTL_HOURS,
        })
        .catch(() => undefined);
    }

    return {
      invited: result,
      skipped: unique.length - newEmails.length,
      total: body.emails.length,
    };
  }

  // ── Legacy Bulk Import (name + email + temp password) ──────────────────

  @Post('users/bulk-import')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  async bulkImport(
    @Body() body: BulkImportDto,
    @CurrentUser() actor: RequestUserPayload,
  ) {
    if (!body.tenantId || !Array.isArray(body.users) || body.users.length === 0) {
      throw new BadRequestException('tenantId and users array are required');
    }

    if (body.users.length > 500) {
      throw new BadRequestException('Maximum 500 users per import');
    }

    this.assertTenantScope(actor, body.tenantId);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: body.tenantId },
    });
    if (!tenant) throw new BadRequestException('Tenant not found');

    const existingEmails = new Set(
      (
        await this.prisma.user.findMany({
          where: {
            email: { in: body.users.map((u) => u.email.toLowerCase()) },
          },
          select: { email: true },
        })
      ).map((u) => u.email.toLowerCase()),
    );

    const validUsers = body.users.filter((u) => {
      const email = u.email.toLowerCase().trim();
      return email.includes('@') && !existingEmails.has(email);
    });

    if (validUsers.length === 0) {
      return { created: 0, skipped: body.users.length, total: body.users.length };
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await this.seatLimit.assertSeatAvailable(
        body.tenantId,
        validUsers.length,
        tx,
      );

      let created = 0;
      for (const u of validUsers) {
        const email = u.email.toLowerCase().trim();
        const randomPassword = crypto.randomBytes(24).toString('base64url');
        const passwordHash = await bcrypt.hash(randomPassword, 10);
        await tx.user.create({
          data: {
            email,
            name: u.name?.trim() || email.split('@')[0],
            passwordHash,
            tenantId: body.tenantId,
            emailVerified: true,
            profileComplete: false,
            orgApprovalStatus: OrgApprovalStatus.APPROVED,
          },
        });
        created++;
      }
      return created;
    });

    return {
      created: result,
      skipped: body.users.length - validUsers.length,
      total: body.users.length,
    };
  }

  // ── Role Toggle: Learner <-> Instructor ────────────────────────────────

  @Patch('users/:userId/toggle-instructor')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  async toggleInstructor(
    @Param('userId') userId: string,
    @CurrentUser() actor: RequestUserPayload,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        tenantId: true,
        trainerApprovedAt: true,
        trainerRequested: true,
      },
    });
    if (!user) throw new BadRequestException('User not found');

    this.assertTenantScope(actor, user.tenantId);

    const isCurrentlyInstructor = !!user.trainerApprovedAt;

    if (isCurrentlyInstructor) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { trainerApprovedAt: null, trainerRequested: false },
      });
      return { userId, role: 'learner', message: 'User demoted to Learner' };
    } else {
      await this.prisma.user.update({
        where: { id: userId },
        data: { trainerRequested: true, trainerApprovedAt: new Date() },
      });
      return { userId, role: 'instructor', message: 'User promoted to Instructor' };
    }
  }

  // ── Company-Admin Approval Queue ───────────────────────────────────────

  @Get('users/pending')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  async listPendingUsers(
    @CurrentUser() actor: RequestUserPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    const scopedTenantId = this.resolveTenantScope(actor, tenantId);
    if (!scopedTenantId) return [];

    return this.prisma.user.findMany({
      where: {
        tenantId: scopedTenantId,
        orgApprovalStatus: OrgApprovalStatus.PENDING,
      },
      select: {
        id: true,
        email: true,
        name: true,
        userType: true,
        emailVerified: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  @Patch('users/:userId/approve')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  async approveUser(
    @Param('userId') userId: string,
    @CurrentUser() actor: RequestUserPayload,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: { select: { id: true, name: true } } },
    });
    if (!user) throw new BadRequestException('User not found');
    if (user.orgApprovalStatus !== OrgApprovalStatus.PENDING) {
      throw new BadRequestException('No pending affiliation for this user');
    }
    if (!user.emailVerified) {
      throw new BadRequestException('User must verify email before approval');
    }

    this.assertTenantScope(actor, user.tenantId);

    await this.prisma.$transaction(async (tx) => {
      const fresh = await tx.user.findUnique({ where: { id: userId } });
      if (!fresh || fresh.orgApprovalStatus !== OrgApprovalStatus.PENDING) {
        throw new BadRequestException('User is no longer pending approval');
      }
      if (!fresh.emailVerified) {
        throw new BadRequestException('User must verify email before approval');
      }
      if (fresh.tenantId) {
        await this.seatLimit.assertSeatAvailable(fresh.tenantId, 1, tx);
      }
      await tx.user.update({
        where: { id: userId },
        data: {
          orgApprovalStatus: OrgApprovalStatus.APPROVED,
          accountStatus: 'ACTIVE',
        },
      });
    });

    this.transactionalEmail
      .sendAccountApproved({
        userId: user.id,
        toEmail: user.email,
        toName: user.name,
        tenantName: user.tenant?.name ?? 'your organization',
      })
      .catch(() => undefined);

    return { success: true, message: 'User approved' };
  }

  @Patch('users/:userId/reject')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  async rejectUser(
    @Param('userId') userId: string,
    @CurrentUser() actor: RequestUserPayload,
    @Body() body?: { reason?: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new BadRequestException('User not found');
    if (user.orgApprovalStatus !== OrgApprovalStatus.PENDING) {
      throw new BadRequestException('No pending affiliation for this user');
    }

    this.assertTenantScope(actor, user.tenantId);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        orgApprovalStatus: OrgApprovalStatus.REJECTED,
        tenantId: null,
      },
    });

    this.transactionalEmail
      .sendAccountRejected({
        userId: user.id,
        toEmail: user.email,
        toName: user.name,
        reason: body?.reason,
      })
      .catch(() => undefined);

    return { success: true, message: 'User rejected' };
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private assertTenantScope(
    actor: RequestUserPayload,
    targetTenantId: string | null,
  ): void {
    if (actor.roles.includes(RbacRole.SUPER_ADMIN)) return;
    if (!actor.tenantId || actor.tenantId !== targetTenantId) {
      throw new ForbiddenException('You can only manage users in your own academy');
    }
  }

  private resolveTenantScope(
    actor: RequestUserPayload,
    requestedTenantId?: string,
  ): string | null {
    if (actor.roles.includes(RbacRole.SUPER_ADMIN)) {
      return requestedTenantId ?? actor.tenantId;
    }
    return actor.tenantId;
  }
}
