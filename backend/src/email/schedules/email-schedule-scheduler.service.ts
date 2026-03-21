import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EmailScheduleService } from './email-schedule.service';

@Injectable()
export class EmailScheduleSchedulerService {
  private readonly logger = new Logger(EmailScheduleSchedulerService.name);
  private processing = false;

  constructor(private readonly schedules: EmailScheduleService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    if (this.processing) {
      this.logger.debug('Email schedule processor already running, skipping tick');
      return;
    }
    this.processing = true;
    try {
      await this.schedules.processDueEmailSchedules();
    } catch (e) {
      this.logger.error(`Email schedule processor error: ${e}`);
    } finally {
      this.processing = false;
    }
  }
}
