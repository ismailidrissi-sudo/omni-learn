import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RbacGuard } from '../auth/guards/rbac.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RbacRole } from '../constants/rbac.constant';
import { EmailProviderConfigService } from './email-provider-config.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('admin/settings/email-provider')
@UseGuards(AuthGuard('jwt'), RbacGuard)
@Roles(RbacRole.SUPER_ADMIN)
export class EmailProviderConfigController {
  constructor(
    private readonly providerConfig: EmailProviderConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async getActive() {
    const config = await this.providerConfig.getActiveConfig();
    if (!config) return { configured: false };
    return { configured: true, ...this.providerConfig.maskedView(config) };
  }

  @Get('all')
  async listAll() {
    const configs = await this.providerConfig.listAll();
    return configs.map((c: any) => this.providerConfig.maskedView(c));
  }

  @Put()
  async updateActive(@Body() body: any) {
    const config = await this.providerConfig.getActiveConfig();
    if (!config) {
      if (!body.providerType || !body.displayName) {
        throw new BadRequestException('providerType and displayName are required for initial setup');
      }
      const created = await this.providerConfig.createConfig({
        ...body,
        isActive: true,
      });
      await this.providerConfig.initResetTimestamps(created.id);
      return { status: 'created', id: created.id };
    }

    await this.providerConfig.updateConfig(config.id, body);
    return { status: 'updated' };
  }

  @Post('test')
  async testConnection(@Body() body?: { configId?: string }) {
    const config = await this.providerConfig.getActiveConfig();
    if (!config && !body?.configId) {
      return { success: false, error: 'No provider configured' };
    }
    const id = body?.configId || config!.id;
    return this.providerConfig.testConnection(id);
  }

  @Get('usage')
  async getUsage() {
    const config = await this.providerConfig.getActiveConfig();
    if (!config) {
      return { configured: false, thisMinute: 0, thisHour: 0, today: 0 };
    }
    const usage = await this.providerConfig.getCurrentUsage(config.id);

    const queueDepth = await (this.prisma as any).emailQueue.count({
      where: { status: { in: ['PENDING', 'SCHEDULED'] } },
    });
    const estimatedMinutes =
      usage.limitPerMinute > 0 ? Math.ceil(queueDepth / usage.limitPerMinute) : null;

    return {
      configured: true,
      ...usage,
      queueDepth,
      estimatedClearMinutes: estimatedMinutes,
    };
  }

  @Put('rate-limits')
  async updateRateLimits(
    @Body()
    body: {
      sendLimitPerMinute?: number;
      sendLimitPerHour?: number;
      sendLimitPerDay?: number;
    },
  ) {
    const config = await this.providerConfig.getActiveConfig();
    if (!config) throw new BadRequestException('No active provider configured');

    const update: any = {};
    if (body.sendLimitPerMinute !== undefined) update.sendLimitPerMinute = body.sendLimitPerMinute;
    if (body.sendLimitPerHour !== undefined) update.sendLimitPerHour = body.sendLimitPerHour;
    if (body.sendLimitPerDay !== undefined) update.sendLimitPerDay = body.sendLimitPerDay;

    if (Object.keys(update).length === 0) {
      throw new BadRequestException('No fields to update');
    }

    await this.providerConfig.updateConfig(config.id, update);
    return { status: 'updated' };
  }
}
