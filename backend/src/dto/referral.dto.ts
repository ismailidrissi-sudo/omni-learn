import { IsString, IsOptional, IsEmail, IsArray, IsInt, Min, Max, IsEnum, ValidateNested, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateReferralCodeDto {
  @IsOptional()
  @IsString()
  label?: string;
}

export class BulkInviteContactDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  name?: string;
}

export class BulkInviteDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkInviteContactDto)
  contacts: BulkInviteContactDto[];

  @IsOptional()
  @IsString()
  referralCodeId?: string;
}

export class TrackReferralClickDto {
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  channel?: string;
}

export class GrantAccessRewardDto {
  @IsString()
  userId: string;

  @IsEnum(['EXPLORER', 'SPECIALIST', 'VISIONARY', 'NEXUS'])
  plan: string;

  @IsInt()
  @Min(1)
  @Max(120)
  durationMonths: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class ReferralAnalyticsQueryDto {
  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  groupBy?: 'day' | 'week' | 'month';
}

export class GmailImportDto {
  @IsString()
  accessToken: string;
}

export class LinkedInImportDto {
  @IsString()
  accessToken: string;
}
