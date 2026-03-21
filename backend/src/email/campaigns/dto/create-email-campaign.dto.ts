import { IsDateString, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateEmailCampaignDto {
  @IsString()
  @MinLength(1)
  subject: string;

  @IsString()
  @MinLength(1)
  bodyHtml: string;

  /**
   * Super admin: `{ "all": true }` (entire platform, capped) or `{ "tenantId": "<uuid>" }` for one tenant.
   * Company admin: ignored — always the admin's tenant.
   */
  @IsOptional()
  @IsObject()
  targetFilter?: Record<string, unknown>;

  /** If set (future time), campaign is created as `scheduled` instead of `draft`. */
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}
