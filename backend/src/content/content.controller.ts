import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, Res,
  UseGuards, UseInterceptors, UploadedFile, BadRequestException, StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { ContentService, CreateContentDto, ScormMetadata } from './content.service';
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';
import { RbacGuard } from '../auth/guards/rbac.guard';
import { ContentOwnerGuard } from '../auth/guards/content-owner.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { RbacRole } from '../constants/rbac.constant';
import { detectProvider } from '../utils/video-provider';
import { CreateContentBodyDto, CreateCourseBodyDto, ValidateUrlDto } from '../dto/content.dto';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';

@Controller('content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get()
  @UseGuards(OptionalJwtGuard)
  async findAll(
    @Query('type') type?: string,
    @Query('admin') admin?: string,
    @CurrentUser() user?: CurrentUserPayload | null,
  ) {
    const adminMode = admin === 'true';
    return this.contentService.findAll(type, user?.sub ?? null, adminMode, user?.roles ?? []);
  }

  private get documentStoragePath(): string {
    return process.env.DOCUMENT_STORAGE_PATH || './data/documents';
  }

  private static readonly ALLOWED_DOC_TYPES: Record<string, string> = {
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  };

  private static readonly MIME_BY_EXT: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };

  private get thumbnailStoragePath(): string {
    return process.env.COURSE_THUMBNAIL_STORAGE_PATH || './data/course-thumbnails';
  }

  private static readonly ALLOWED_THUMB_TYPES: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
  };

  private static readonly THUMB_MIME_BY_EXT: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  };

  @Post('upload-document')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.INSTRUCTOR)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20_000_000 } }))
  async uploadDocument(
    @UploadedFile() file: { buffer: Buffer; mimetype: string; originalname: string; size: number } | undefined,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('No file provided');
    if (file.size > 20_000_000) throw new BadRequestException('File must be at most 20 MB');

    const ext = ContentController.ALLOWED_DOC_TYPES[file.mimetype]
      || (/\.docx$/i.test(file.originalname) ? '.docx' : null)
      || (/\.doc$/i.test(file.originalname) ? '.doc' : null)
      || (/\.pdf$/i.test(file.originalname) ? '.pdf' : null);

    if (!ext) {
      throw new BadRequestException('Only PDF, DOC, and DOCX files are allowed');
    }

    mkdirSync(this.documentStoragePath, { recursive: true });
    const filename = `${randomUUID()}${ext}`;
    const filePath = join(this.documentStoragePath, filename);
    writeFileSync(filePath, file.buffer);

    return { url: `/content/documents/${filename}`, filename };
  }

  @Get('documents/:filename')
  async serveDocument(
    @Param('filename') filename: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '');
    const filePath = join(this.documentStoragePath, safeName);

    if (!existsSync(filePath)) {
      throw new BadRequestException('Document not found');
    }

    const ext = extname(safeName).toLowerCase();
    const mime = ContentController.MIME_BY_EXT[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');

    const buffer = readFileSync(filePath);
    return new StreamableFile(buffer);
  }

  @Post('upload-course-thumbnail')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.INSTRUCTOR)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5_000_000 } }))
  async uploadCourseThumbnail(
    @UploadedFile() file: { buffer: Buffer; mimetype: string; originalname: string; size: number } | undefined,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('No file provided');
    if (file.size > 5_000_000) throw new BadRequestException('Image must be at most 5 MB');

    const ext = ContentController.ALLOWED_THUMB_TYPES[file.mimetype];
    if (!ext) {
      throw new BadRequestException('Only JPEG, PNG, WebP, and GIF images are allowed');
    }

    mkdirSync(this.thumbnailStoragePath, { recursive: true });
    const filename = `${randomUUID()}${ext}`;
    const filePath = join(this.thumbnailStoragePath, filename);
    writeFileSync(filePath, file.buffer);

    return { url: `/content/thumbnails/${filename}`, filename };
  }

  @Get('thumbnails/:filename')
  async serveThumbnail(
    @Param('filename') filename: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '');
    const filePath = join(this.thumbnailStoragePath, safeName);

    if (!existsSync(filePath)) {
      throw new BadRequestException('Image not found');
    }

    const ext = extname(safeName).toLowerCase();
    const mime = ContentController.THUMB_MIME_BY_EXT[ext] || 'image/jpeg';
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'public, max-age=86400');

    const buffer = readFileSync(filePath);
    return new StreamableFile(buffer);
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
    @CurrentUser() user?: CurrentUserPayload | null,
  ) {
    const adminMode = admin === 'true';
    return this.contentService.findOne(id, user?.sub ?? null, adminMode, user?.roles ?? []);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.INSTRUCTOR)
  async create(@Body() body: CreateContentBodyDto, @CurrentUser() user: CurrentUserPayload) {
    return this.contentService.create(body, { createdById: user.sub });
  }

  @Post('courses')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.INSTRUCTOR)
  async createCourse(@Body() body: CreateCourseBodyDto, @CurrentUser() user: CurrentUserPayload) {
    return this.contentService.createCourse(
      body.title,
      body.scormMetadata,
      body.durationMinutes,
      {
        description: body.description,
        domainId: body.domainId,
        tenantIds: body.tenantIds,
        userIds: body.userIds,
        isFoundational: body.isFoundational,
        availablePlans: body.availablePlans,
        availableInEnterprise: body.availableInEnterprise,
        language: body.language,
        createdById: user.sub,
      },
    );
  }

  @Put(':id')
  @UseGuards(AuthGuard('jwt'), RbacGuard, ContentOwnerGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.INSTRUCTOR)
  async update(
    @Param('id') id: string,
    @Body() body: Partial<CreateContentDto>,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.contentService.update(id, body, { userId: user.sub, roles: user.roles });
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RbacGuard, ContentOwnerGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.INSTRUCTOR)
  async remove(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.contentService.remove(id, { userId: user.sub, roles: user.roles });
  }
}
