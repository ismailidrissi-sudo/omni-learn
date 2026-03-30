import { IsString, IsOptional, IsNumber, IsArray, IsBoolean, IsObject } from 'class-validator';

export class CreateContentBodyDto {
  @IsString()
  type: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  domainId?: string;

  @IsOptional()
  @IsString()
  mediaId?: string;

  @IsOptional()
  @IsNumber()
  durationMinutes?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tenantIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  userIds?: string[];

  @IsOptional()
  @IsNumber()
  accessLevel?: number;

  @IsOptional()
  @IsString()
  sectorTag?: string;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsBoolean()
  isFoundational?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  availablePlans?: string[];

  @IsOptional()
  @IsBoolean()
  availableInEnterprise?: boolean;

  @IsOptional()
  @IsString()
  language?: string;
}

export class CreateCourseBodyDto {
  @IsString()
  title: string;

  @IsObject()
  scormMetadata: {
    scormPackageUrl?: string;
    xapiEndpoint?: string;
    sections?: Array<{ id: string; title: string; duration?: number }>;
    totalDuration?: number;
    version?: '1.2' | '2004';
  };

  @IsOptional()
  @IsNumber()
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  domainId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tenantIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  userIds?: string[];

  @IsOptional()
  @IsBoolean()
  isFoundational?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  availablePlans?: string[];

  @IsOptional()
  @IsBoolean()
  availableInEnterprise?: boolean;

  @IsOptional()
  @IsString()
  language?: string;
}

export class ValidateUrlDto {
  @IsString()
  url: string;
}
