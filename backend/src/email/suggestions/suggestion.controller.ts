import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RbacGuard } from '../../auth/guards/rbac.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RbacRole } from '../../constants/rbac.constant';
import { SuggestionConfigService } from './suggestion-config.service';

@Controller('admin/settings/content-suggestions')
@UseGuards(AuthGuard('jwt'), RbacGuard)
@Roles(RbacRole.SUPER_ADMIN)
export class SuggestionController {
  constructor(private readonly suggestionConfig: SuggestionConfigService) {}

  @Get()
  async getConfig() {
    return this.suggestionConfig.getConfig();
  }

  @Put()
  async updateConfig(@Body() body: unknown) {
    return this.suggestionConfig.saveConfig(body);
  }
}
