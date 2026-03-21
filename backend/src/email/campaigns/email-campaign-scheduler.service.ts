import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EmailCampaignService } from './email-campaign.service';

/**
 * Dispatches email campaigns that were saved with a future {@link EmailCampaign.scheduledAt}.
 */
@Injectable()
export class EmailCampaignSchedulerService {
  private readonly logger = new Logger(EmailCampaignSchedulerService.name);
  private processing = false;

  constructor(private readonly campaigns: EmailCampaignService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    if (this.processing) {
      this.logger.debug('Campaign scheduler already running, skipping tick');
      return;
    }
    this.processing = true;
    try {
      await this.campaigns.processDueScheduledCampaigns();
    } catch (e) {
      this.logger.error(`Campaign scheduler error: ${e}`);
    } finally {
      this.processing = false;
    }
  }
}
