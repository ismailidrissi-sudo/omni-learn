import {
  Body,
  Controller,
  Delete,
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
import { EmailScheduleService } from './email-schedule.service';
import { CreateEmailScheduleDto } from './dto/create-email-schedule.dto';
import { UpdateEmailScheduleDto } from './dto/update-email-schedule.dto';

@Controller('admin/email-schedules')
@UseGuards(AuthGuard('jwt'), RbacGuard)
@Roles(RbacRole.SUPER_ADMIN)
export class EmailScheduleAdminController {
  constructor(private readonly schedules: EmailScheduleService) {}

  @Post()
  create(@Body() dto: CreateEmailScheduleDto, @Req() req: { user: { sub: string } }) {
    return this.schedules.createPlatform(req.user.sub, dto);
  }

  @Get()
  list() {
    return this.schedules.listPlatform();
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.schedules.getForPlatform(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEmailScheduleDto) {
    return this.schedules.updatePlatform(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.schedules.deletePlatform(id);
  }
}
