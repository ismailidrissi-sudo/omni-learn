import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ContentService, CreateContentDto, ScormMetadata } from './content.service';
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';
import { RbacGuard } from '../auth/guards/rbac.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RbacRole } from '../constants/rbac.constant';
import { detectProvider } from '../utils/video-provider';
import { CreateContentBodyDto, CreateCourseBodyDto, ValidateUrlDto } from '../dto/content.dto';

@Controller('content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get()
  @UseGuards(OptionalJwtGuard)
  async findAll(
    @Query('type') type?: string,
    @Query('admin') admin?: string,
    @CurrentUser('sub') userId?: string,
  ) {
    const adminMode = admin === 'true';
    return this.contentService.findAll(type, userId, adminMode);
  }

  @Post('validate-url')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.INSTRUCTOR)
  async validateUrl(@Body() body: ValidateUrlDto) {
    return detectProvider(body.url);
  }

  @Get(':id')
  @UseGuards(OptionalJwtGuard)
  async findOne(
    @Param('id') id: string,
    @Query('admin') admin?: string,
    @CurrentUser('sub') userId?: string,
  ) {
    const adminMode = admin === 'true';
    return this.contentService.findOne(id, userId, adminMode);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.INSTRUCTOR)
  async create(@Body() body: CreateContentBodyDto) {
    return this.contentService.create(body);
  }

  @Post('courses')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.INSTRUCTOR)
  async createCourse(@Body() body: CreateCourseBodyDto) {
    return this.contentService.createCourse(
      body.title,
      body.scormMetadata,
      body.durationMinutes,
      {
        description: body.description,
        domainId: body.domainId,
        tenantIds: body.tenantIds,
        userIds: body.userIds,
      },
    );
  }

  @Put(':id')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.INSTRUCTOR)
  async update(@Param('id') id: string, @Body() body: Partial<CreateContentDto>) {
    return this.contentService.update(id, body);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  async remove(@Param('id') id: string) {
    return this.contentService.remove(id);
  }
}
