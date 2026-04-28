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
  Logger,
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
import { OrgApprovalStatus, UserAccountStatus, SubscriptionPlan } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { CourseEnrollmentService } from '../course-enrollment/course-enrollment.service';
import { LearningPathService } from '../learning-path/learning-path.service';

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
  private readonly log = new Logger(UserManagementController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly seatLimit: SeatLimitService,
    private readonly transactionalEmail: TransactionalEmailService,
    private readonly courseEnrollment: CourseEnrollmentService,
    private readonly learningPath: LearningPathService,
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

    const existingUsers = await this.prisma.user.findMany({
      where: { email: { in: unique } },
      select: { id: true, email: true, tenantId: true },
    });

    const byEmail = new Map<string, { id: string; tenantId: string | null }>();
    for (const u of existingUsers) {
      byEmail.set(u.email.toLowerCase(), { id: u.id, tenantId: u.tenantId });
    }

    const newEmails: string[] = [];
    const toAttach: Array<{ email: string; userId: string }> = [];
    let alreadyMember = 0;
    let existsElsewhere = 0;

    for (const email of unique) {
      const rec = byEmail.get(email);
      if (!rec) {
        newEmails.push(email);
        continue;
      }
      if (rec.tenantId === null) {
        toAttach.push({ email, userId: rec.id });
      } else if (rec.tenantId === body.tenantId) {
        alreadyMember++;
      } else {
        existsElsewhere++;
      }
    }

    if (newEmails.length === 0 && toAttach.length === 0) {
      return {
        invited: 0,
        attached: 0,
        alreadyMember,
        existsElsewhere,
        total: body.emails.length,
      };
    }

    const pendingEmails: Array<{ email: string; userId: string; rawToken: string }> = [];

    const txResult = await this.prisma.$transaction(async (tx) => {
      await this.seatLimit.assertSeatAvailable(
        body.tenantId,
        newEmails.length + toAttach.length,
        tx,
      );

      let invited = 0;
      let attached = 0;

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

      for (const { email, userId } of toAttach) {
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = await bcrypt.hash(rawToken, 10);
        const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_HOURS * 60 * 60 * 1000);

        await tx.user.update({
          where: { id: userId },
          data: {
            tenantId: body.tenantId,
            emailVerified: true,
            orgApprovalStatus: OrgApprovalStatus.APPROVED,
            magicLinkTokenHash: tokenHash,
            magicLinkExpiresAt: expiresAt,
          },
        });

        pendingEmails.push({ email, userId, rawToken });
        attached++;
      }

      return { invited, attached };
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
      invited: txResult.invited,
      attached: txResult.attached,
      alreadyMember,
      existsElsewhere,
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

  /**
   * Assign or remove a user's academy (tenant) membership.
   * Super admin: any tenant or removal. Company admin: only assign to own tenant; cannot remove.
   */
  @Patch('users/:userId/academy')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  async assignUserAcademy(
    @Param('userId') userId: string,
    @Body() body: { tenantId: string | null },
    @CurrentUser() actor: RequestUserPayload,
  ) {
    if (!('tenantId' in body)) {
      throw new BadRequestException('tenantId is required (use null to remove from academy)');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        tenantId: true,
        orgApprovalStatus: true,
      },
    });
    if (!user) throw new BadRequestException('User not found');

    const isSuper = actor.roles.includes(RbacRole.SUPER_ADMIN);
    const nextTenantId = body.tenantId === null || body.tenantId === '' ? null : body.tenantId;

    if (nextTenantId === null) {
      if (!isSuper) {
        throw new ForbiddenException('Only a platform admin can remove a user from an academy');
      }
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          tenantId: null,
          orgApprovalStatus: OrgApprovalStatus.NONE,
          accountStatus: UserAccountStatus.ACTIVE,
        },
      });
      this.log.log(`Super admin removed user ${userId} (${user.email}) from academy`);
      return { success: true, tenantId: null, orgApprovalStatus: OrgApprovalStatus.NONE };
    }

    if (!isSuper) {
      if (!actor.tenantId || nextTenantId !== actor.tenantId) {
        throw new ForbiddenException('You can only assign users to your own academy');
      }
      if (user.tenantId !== null && user.tenantId !== actor.tenantId) {
        throw new ForbiddenException('You cannot move users from another academy');
      }
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: nextTenantId },
      select: { id: true },
    });
    if (!tenant) throw new BadRequestException('Academy (tenant) not found');

    if (user.tenantId === nextTenantId && user.orgApprovalStatus === OrgApprovalStatus.APPROVED) {
      return {
        success: true,
        tenantId: nextTenantId,
        orgApprovalStatus: OrgApprovalStatus.APPROVED,
        message: 'User already approved in this academy',
      };
    }

    await this.prisma.$transaction(async (tx) => {
      await this.seatLimit.assertSeatAvailable(nextTenantId, 1, tx);
      await tx.user.update({
        where: { id: userId },
        data: {
          tenantId: nextTenantId,
          orgApprovalStatus: OrgApprovalStatus.APPROVED,
          accountStatus: UserAccountStatus.ACTIVE,
        },
      });
    });

    this.log.log(
      `${isSuper ? 'Super admin' : 'Company admin'} assigned user ${userId} (${user.email}) to academy ${nextTenantId}`,
    );
    return {
      success: true,
      tenantId: nextTenantId,
      orgApprovalStatus: OrgApprovalStatus.APPROVED,
    };
  }

  @Patch('users/:userId/plan')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  async updateUserPlan(
    @Param('userId') userId: string,
    @Body() body: { planId: string },
    @CurrentUser() actor: RequestUserPayload,
  ) {
    if (!body?.planId || typeof body.planId !== 'string') {
      throw new BadRequestException('planId is required');
    }
    const allowed = Object.values(SubscriptionPlan) as string[];
    if (!allowed.includes(body.planId)) {
      throw new BadRequestException('Invalid planId');
    }
    const planId = body.planId as SubscriptionPlan;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, tenantId: true },
    });
    if (!user) throw new BadRequestException('User not found');
    this.assertTenantScope(actor, user.tenantId);

    await this.prisma.user.update({
      where: { id: userId },
      data: { planId },
    });
    return { success: true, planId };
  }

  @Patch('users/:userId/account-status')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  async updateUserAccountStatus(
    @Param('userId') userId: string,
    @Body() body: { accountStatus: UserAccountStatus },
    @CurrentUser() actor: RequestUserPayload,
  ) {
    if (body?.accountStatus !== UserAccountStatus.ACTIVE && body?.accountStatus !== UserAccountStatus.SUSPENDED) {
      throw new BadRequestException('accountStatus must be ACTIVE or SUSPENDED');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, tenantId: true },
    });
    if (!user) throw new BadRequestException('User not found');
    this.assertTenantScope(actor, user.tenantId);

    await this.prisma.user.update({
      where: { id: userId },
      data: { accountStatus: body.accountStatus },
    });
    return { success: true, accountStatus: body.accountStatus };
  }

  @Post('users/:userId/enrollments/course')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  async adminEnrollCourse(
    @Param('userId') userId: string,
    @Body() body: { courseId: string; deadline?: string },
    @CurrentUser() actor: RequestUserPayload,
  ) {
    if (!body?.courseId) throw new BadRequestException('courseId is required');
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, tenantId: true },
    });
    if (!user) throw new BadRequestException('User not found');
    this.assertTenantScope(actor, user.tenantId);

    return this.courseEnrollment.enrollUser(
      userId,
      body.courseId,
      body.deadline ? new Date(body.deadline) : undefined,
      { actorUserId: actor.sub },
    );
  }

  @Post('users/:userId/enrollments/path')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  async adminEnrollPath(
    @Param('userId') userId: string,
    @Body() body: { pathId: string; deadline?: string },
    @CurrentUser() actor: RequestUserPayload,
  ) {
    if (!body?.pathId) throw new BadRequestException('pathId is required');
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, tenantId: true },
    });
    if (!user) throw new BadRequestException('User not found');
    this.assertTenantScope(actor, user.tenantId);

    return this.learningPath.enrollUser(
      userId,
      body.pathId,
      body.deadline ? new Date(body.deadline) : undefined,
      { actorUserId: actor.sub },
    );
  }

  // ── Bulk admin enrollment for academy admins ───────────────────────────

  @Post('users/enrollments/bulk-course')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  async adminBulkEnrollCourse(
    @Body() body: { userIds: string[]; courseId: string; deadline?: string },
    @CurrentUser() actor: RequestUserPayload,
  ) {
    if (!body?.courseId) throw new BadRequestException('courseId is required');
    if (!Array.isArray(body.userIds) || body.userIds.length === 0) {
      throw new BadRequestException('userIds array is required');
    }
    if (body.userIds.length > 500) {
      throw new BadRequestException('Maximum 500 users per bulk enrollment');
    }

    const uniqueIds = [...new Set(body.userIds)];
    const users = await this.prisma.user.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, tenantId: true },
    });
    for (const u of users) this.assertTenantScope(actor, u.tenantId);

    const deadline = body.deadline ? new Date(body.deadline) : undefined;
    let enrolled = 0;
    let skipped = 0;
    const failures: Array<{ userId: string; reason: string }> = [];

    for (const u of users) {
      try {
        const existing = await this.prisma.courseEnrollment.findUnique({
          where: { userId_courseId: { userId: u.id, courseId: body.courseId } },
          select: { id: true },
        });
        if (existing) {
          skipped++;
          continue;
        }
        await this.courseEnrollment.enrollUser(u.id, body.courseId, deadline, {
          actorUserId: actor.sub,
        });
        enrolled++;
      } catch (err) {
        failures.push({
          userId: u.id,
          reason: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return {
      enrolled,
      skipped,
      failed: failures.length,
      requested: body.userIds.length,
      failures,
    };
  }

  @Post('users/enrollments/bulk-path')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  async adminBulkEnrollPath(
    @Body() body: { userIds: string[]; pathId: string; deadline?: string },
    @CurrentUser() actor: RequestUserPayload,
  ) {
    if (!body?.pathId) throw new BadRequestException('pathId is required');
    if (!Array.isArray(body.userIds) || body.userIds.length === 0) {
      throw new BadRequestException('userIds array is required');
    }
    if (body.userIds.length > 500) {
      throw new BadRequestException('Maximum 500 users per bulk enrollment');
    }

    const uniqueIds = [...new Set(body.userIds)];
    const users = await this.prisma.user.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, tenantId: true },
    });
    for (const u of users) this.assertTenantScope(actor, u.tenantId);

    const deadline = body.deadline ? new Date(body.deadline) : undefined;
    let enrolled = 0;
    let skipped = 0;
    const failures: Array<{ userId: string; reason: string }> = [];

    for (const u of users) {
      try {
        const existing = await this.prisma.pathEnrollment.findUnique({
          where: { userId_pathId: { userId: u.id, pathId: body.pathId } },
          select: { id: true },
        });
        if (existing) {
          skipped++;
          continue;
        }
        await this.learningPath.enrollUser(u.id, body.pathId, deadline, {
          actorUserId: actor.sub,
        });
        enrolled++;
      } catch (err) {
        failures.push({
          userId: u.id,
          reason: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return {
      enrolled,
      skipped,
      failed: failures.length,
      requested: body.userIds.length,
      failures,
    };
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
