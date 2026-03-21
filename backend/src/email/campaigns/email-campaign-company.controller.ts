import { Body, Controller, ForbiddenException, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RbacGuard } from '../../auth/guards/rbac.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RbacRole } from '../../constants/rbac.constant';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailCampaignService } from './email-campaign.service';
import { CreateEmailCampaignDto } from './dto/create-email-campaign.dto';
import { ScheduleEmailCampaignDto } from './dto/schedule-email-campaign.dto';

@Controller('company-admin/email-campaigns')
@UseGuards(AuthGuard('jwt'), RbacGuard)
@Roles(RbacRole.COMPANY_ADMIN)
export class EmailCampaignCompanyController {
  constructor(
    private readonly campaignService: EmailCampaignService,
    private readonly prisma: PrismaService,
  ) {}

  private async requireTenantActor(req: { user: { sub: string } }) {
    const u = await this.prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { tenantId: true, companyAdminApprovedAt: true },
    });
    if (!u?.tenantId) {
      throw new ForbiddenException('Company admin must belong to a tenant');
    }
    if (!u.companyAdminApprovedAt) {
      throw new ForbiddenException('Company admin is not approved');
    }
    return u.tenantId;
  }

  @Post()
  async create(@Body() dto: CreateEmailCampaignDto, @Req() req: { user: { sub: string } }) {
    const tenantId = await this.requireTenantActor(req);
    return this.campaignService.createTenantCampaign(tenantId, req.user.sub, dto);
  }

  @Get()
  async list(@Req() req: { user: { sub: string } }) {
    const tenantId = await this.requireTenantActor(req);
    return this.campaignService.listTenantCampaigns(tenantId);
  }

  @Post(':id/send')
  async send(@Param('id') id: string, @Req() req: { user: { sub: string } }) {
    const tenantId = await this.requireTenantActor(req);
    return this.campaignService.sendTenantCampaign(id, tenantId);
  }

  @Post(':id/schedule')
  async setSchedule(
    @Param('id') id: string,
    @Body() dto: ScheduleEmailCampaignDto,
    @Req() req: { user: { sub: string } },
  ) {
    const tenantId = await this.requireTenantActor(req);
    return this.campaignService.setScheduleTenant(id, tenantId, dto.scheduledAt);
  }

  @Post(':id/cancel-schedule')
  async cancelSchedule(@Param('id') id: string, @Req() req: { user: { sub: string } }) {
    const tenantId = await this.requireTenantActor(req);
    return this.campaignService.cancelScheduleTenant(id, tenantId);
  }
}
