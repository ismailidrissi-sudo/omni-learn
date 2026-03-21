import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RbacGuard } from '../../auth/guards/rbac.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RbacRole } from '../../constants/rbac.constant';
import { EmailCampaignService } from './email-campaign.service';
import { CreateEmailCampaignDto } from './dto/create-email-campaign.dto';
import { ScheduleEmailCampaignDto } from './dto/schedule-email-campaign.dto';

@Controller('admin/email-campaigns')
@UseGuards(AuthGuard('jwt'), RbacGuard)
@Roles(RbacRole.SUPER_ADMIN)
export class EmailCampaignAdminController {
  constructor(private readonly campaignService: EmailCampaignService) {}

  @Post()
  create(@Body() dto: CreateEmailCampaignDto, @Req() req: { user: { sub: string } }) {
    return this.campaignService.createPlatformCampaign(req.user.sub, dto);
  }

  @Get()
  list() {
    return this.campaignService.listPlatformCampaigns();
  }

  @Post(':id/send')
  send(@Param('id') id: string) {
    return this.campaignService.sendPlatformCampaign(id);
  }

  @Post(':id/schedule')
  setSchedule(@Param('id') id: string, @Body() dto: ScheduleEmailCampaignDto) {
    return this.campaignService.setSchedulePlatform(id, dto.scheduledAt);
  }

  @Post(':id/cancel-schedule')
  cancelSchedule(@Param('id') id: string) {
    return this.campaignService.cancelSchedulePlatform(id);
  }
}
