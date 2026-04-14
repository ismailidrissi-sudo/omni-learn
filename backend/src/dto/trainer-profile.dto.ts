import { IsString, IsOptional, IsNumber, IsArray, IsBoolean, IsObject, IsEnum, MaxLength } from 'class-validator';

export class UpsertTrainerProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  headline?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsString()
  bannerUrl?: string;

  @IsOptional()
  @IsString()
  resumeUrl?: string;

  @IsOptional()
  @IsArray()
  specializations?: string[];

  @IsOptional()
  @IsArray()
  certifications?: Array<{
    name: string;
    issuer?: string;
    year?: number;
    url?: string;
    numero?: string;
    badgeUrl?: string;
    expire?: boolean;
    dateExpiration?: string;
  }>;

  @IsOptional()
  @IsArray()
  distinctions?: Array<{ title: string; issuer?: string; year?: number; description?: string }>;

  @IsOptional()
  @IsArray()
  languages?: unknown[];

  @IsOptional()
  @IsObject()
  socialLinks?: {
    linkedin?: string;
    twitter?: string;
    github?: string;
    youtube?: string;
    website?: string;
    researchgate?: string;
  };

  @IsOptional()
  @IsArray()
  education?: Array<{ institution: string; degree: string; field?: string; year?: number }>;

  @IsOptional()
  @IsArray()
  experience?: Array<{ company: string; role: string; from?: string; to?: string; description?: string }>;

  @IsOptional()
  @IsArray()
  expertiseDomains?: Array<{ domain: string; level: number; source?: string }>;

  @IsOptional()
  @IsObject()
  availability?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  websiteUrl?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsNumber()
  yearsOfExperience?: number;

  @IsOptional()
  @IsNumber()
  hourlyRate?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsBoolean()
  availableForHire?: boolean;

  @IsOptional()
  @IsString()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  featuredVideoUrl?: string;
}

export class PublishTrainerProfileDto {
  @IsEnum(['DRAFT', 'PUBLISHED'])
  status: 'DRAFT' | 'PUBLISHED';
}
