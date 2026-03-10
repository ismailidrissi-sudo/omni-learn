import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ContentService, CreateContentDto, ScormMetadata } from './content.service';
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get()
  @UseGuards(OptionalJwtGuard)
  async findAll(
    @Query('type') type?: string,
    @CurrentUser('sub') userId?: string,
  ) {
    return this.contentService.findAll(type, userId);
  }

  @Get(':id')
  @UseGuards(OptionalJwtGuard)
  async findOne(
    @Param('id') id: string,
    @CurrentUser('sub') userId?: string,
  ) {
    return this.contentService.findOne(id, userId);
  }

  @Post()
  async create(@Body() body: CreateContentDto) {
    return this.contentService.create(body);
  }

  @Post('courses')
  async createCourse(
    @Body()
    body: {
      title: string;
      scormMetadata: ScormMetadata;
      durationMinutes?: number;
      description?: string;
      domainId?: string;
      tenantIds?: string[];
      userIds?: string[];
    },
  ) {
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
  async update(@Param('id') id: string, @Body() body: Partial<CreateContentDto>) {
    return this.contentService.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.contentService.remove(id);
  }
}
