import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class EmailScheduleAudienceDto {
  @IsOptional()
  @IsBoolean()
  all?: boolean;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  userType?: string;
}

/** One-shot or recurring broadcast; `cron` requires `cronExpression`. */
export class CreateEmailScheduleDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(['once', 'cron'])
  scheduleType: 'once' | 'cron';

  /** Required for `once`. For `cron`, optional — first fire is computed from `cronExpression` if omitted. */
  @IsOptional()
  @IsDateString()
  nextRunAt?: string;

  /** Required when `scheduleType` is `cron` (standard 5-field cron, evaluated in UTC). */
  @IsOptional()
  @IsString()
  cronExpression?: string;

  /** Required for `custom_broadcast` (default). */
  @IsOptional()
  @IsString()
  @MinLength(1)
  subject?: string;

  /** Required for `custom_broadcast` (default). */
  @IsOptional()
  @IsString()
  @MinLength(1)
  bodyHtml?: string;

  /** For `template_broadcast`: DB template slug (see `email_templates`). */
  @IsOptional()
  @IsString()
  templateSlug?: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;

  /** Extra filters: `all` / `tenantId` (platform only), `userType`. */
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => EmailScheduleAudienceDto)
  audience?: EmailScheduleAudienceDto;

  /** `custom_broadcast` (HTML) or `template_broadcast` (DB template). */
  @IsOptional()
  @IsString()
  emailEventType?: string;

  /** Super admin: scope sends to this tenant's users (optional). */
  @IsOptional()
  @IsString()
  tenantId?: string;
}
