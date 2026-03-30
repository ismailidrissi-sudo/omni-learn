import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ANALYTICS_QUEUE } from './analytics-geo.processor';

/**
 * Registers BullMQ repeatable jobs for geo rollups (UTC cron).
 */
@Injectable()
export class AnalyticsGeoJobsService implements OnModuleInit {
  private readonly log = new Logger(AnalyticsGeoJobsService.name);

  constructor(@InjectQueue(ANALYTICS_QUEUE) private readonly analyticsQueue: Queue) {}

  async onModuleInit() {
    if (process.env.BULL_ANALYTICS_JOBS === 'false') {
      this.log.log('BULL_ANALYTICS_JOBS=false — skipping repeatable geo jobs');
      return;
    }

    try {
      await this.analyticsQueue.add(
        'geo-rollup-hourly',
        {},
        { repeat: { pattern: '7 * * * *' }, jobId: 'repeat-geo-hourly' },
      );
      await this.analyticsQueue.add(
        'geo-rollup-daily',
        {},
        { repeat: { pattern: '5 0 * * *' }, jobId: 'repeat-geo-daily' },
      );
      await this.analyticsQueue.add(
        'geo-rollup-weekly',
        {},
        { repeat: { pattern: '10 0 * * 1' }, jobId: 'repeat-geo-weekly' },
      );
      await this.analyticsQueue.add(
        'geo-rollup-monthly',
        {},
        { repeat: { pattern: '15 0 1 * *' }, jobId: 'repeat-geo-monthly' },
      );
      this.log.log('Registered repeatable geo analytics jobs');

      if (process.env.ENABLE_GEO_EMAIL_REPORTS === 'true') {
        await this.analyticsQueue.add(
          'send-geo-report',
          {},
          { repeat: { pattern: '0 8 2 * *' }, jobId: 'repeat-send-geo-report' },
        );
        this.log.log('Registered monthly geo email report (2nd day 08:00 UTC)');
      }
    } catch (e) {
      this.log.warn(`Could not register BullMQ repeatables (Redis down?): ${e}`);
    }
  }
}
