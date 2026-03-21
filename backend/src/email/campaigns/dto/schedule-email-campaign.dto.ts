import { IsDateString } from 'class-validator';

export class ScheduleEmailCampaignDto {
  /** ISO 8601 datetime — must be in the future when scheduling. */
  @IsDateString()
  scheduledAt: string;
}
