import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RbacGuard } from '../../auth/guards/rbac.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RbacRole } from '../../constants/rbac.constant';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailScheduleService } from './email-schedule.service';
import { CreateEmailScheduleDto } from './dto/create-email-schedule.dto';
import { UpdateEmailScheduleDto } from './dto/update-email-schedule.dto';

@Controller('company-admin/email-schedules')
@UseGuards(AuthGuard('jwt'), RbacGuard)
@Roles(RbacRole.COMPANY_ADMIN)
export class EmailScheduleCompanyController {
  constructor(
    private readonly schedules: EmailScheduleService,
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
  async create(@Body() dto: CreateEmailScheduleDto, @Req() req: { user: { sub: string } }) {
    const tenantId = await this.requireTenantActor(req);
    return this.schedules.createForTenant(tenantId, req.user.sub, dto);
  }

  @Get()
  async list(@Req() req: { user: { sub: string } }) {
    const tenantId = await this.requireTenantActor(req);
    return this.schedules.listTenant(tenantId);
  }

  @Get(':id')
  async getOne(@Param('id') id: string, @Req() req: { user: { sub: string } }) {
    const tenantId = await this.requireTenantActor(req);
    return this.schedules.getForTenant(id, tenantId);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateEmailScheduleDto,
    @Req() req: { user: { sub: string } },
  ) {
    const tenantId = await this.requireTenantActor(req);
    return this.schedules.updateTenant(id, tenantId, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: { user: { sub: string } }) {
    const tenantId = await this.requireTenantActor(req);
    return this.schedules.deleteTenant(id, tenantId);
  }
}
