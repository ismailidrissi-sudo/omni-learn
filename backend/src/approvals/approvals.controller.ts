import { Controller, Get, Param, Post, Query, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApprovalRequestStatus, ApprovalRequestType } from '@prisma/client';
import { ApprovalsService, ApprovalActor } from './approvals.service';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { RequestUserPayload } from '../auth/types/request-user.types';

function toActor(user: RequestUserPayload): ApprovalActor {
  return {
    userId: user.sub,
    tenantId: user.tenantId,
    permissions: user.permissions,
  };
}

@Controller('approvals')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Permissions('approvals:review')
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Get()
  async list(
    @Req() req: { user: RequestUserPayload },
    @Query('status') status?: ApprovalRequestStatus,
    @Query('type') type?: ApprovalRequestType,
  ) {
    return this.approvals.list(toActor(req.user), { status, type });
  }

  @Get(':id')
  async getOne(@Req() req: { user: RequestUserPayload }, @Param('id') id: string) {
    return this.approvals.getOne(toActor(req.user), id);
  }

  @Post(':id/approve')
  async approve(
    @Req() req: { user: RequestUserPayload },
    @Param('id') id: string,
    @Body() body: { reviewNote?: string },
  ) {
    return this.approvals.approve(toActor(req.user), id, body?.reviewNote);
  }

  @Post(':id/reject')
  async reject(
    @Req() req: { user: RequestUserPayload },
    @Param('id') id: string,
    @Body() body: { reviewNote?: string },
  ) {
    return this.approvals.reject(toActor(req.user), id, body?.reviewNote);
  }
}
