import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { GeoRollupService } from './geo-rollup.service';
import { GeoBackfillService } from './geo-backfill.service';
import { GeoScheduledReportService } from './geo-scheduled-report.service';

export const ANALYTICS_QUEUE = 'analytics';

@Processor(ANALYTICS_QUEUE, { concurrency: 2 })
export class AnalyticsGeoProcessor extends WorkerHost {
  private readonly log = new Logger(AnalyticsGeoProcessor.name);

  constructor(
    private readonly rollups: GeoRollupService,
    private readonly backfill: GeoBackfillService,
    private readonly geoReport: GeoScheduledReportService,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    const now = new Date();

    switch (job.name) {
      case 'geo-rollup-hourly': {
        const anchor = new Date(now.getTime() - 60 * 60 * 1000);
        return this.rollups.runRollup('hourly', anchor);
      }
      case 'geo-rollup-daily': {
        const anchor = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        return this.rollups.runRollup('daily', anchor);
      }
      case 'geo-rollup-weekly': {
        return this.rollups.runRollup('weekly', now);
      }
      case 'geo-rollup-monthly': {
        return this.rollups.runRollup('monthly', now);
      }
      case 'geo-backfill':
        return this.backfill.runBatch(job.data?.limit ?? 300);
      case 'send-geo-report': {
        const end = new Date();
        const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        return this.geoReport.sendReportsForPeriod(start, end);
      }
      default:
        this.log.warn(`Unknown job name: ${job.name}`);
        return { ok: false };
    }
  }
}
