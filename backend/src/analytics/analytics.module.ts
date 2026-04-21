import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { AnalyticsService } from './analytics.service';
import { SessionTrackingService } from './session-tracking.service';
import { DeepAnalyticsService } from './deep-analytics.service';
import { CsvExportService } from './csv-export.service';
import { AnalyticsController } from './analytics.controller';
import { GeoResolverService } from './geo-resolver.service';
import { GeoRollupService } from './geo-rollup.service';
import { GeoBackfillService } from './geo-backfill.service';
import { GeoRedisCacheService } from './geo-redis-cache.service';
import { AnalyticsGeoProcessor, ANALYTICS_QUEUE } from './analytics-geo.processor';
import { AnalyticsGeoJobsService } from './analytics-geo-jobs.service';
import { AnalyticsSocketGateway } from './analytics-socket.gateway';
import { AnalyticsLiveService } from './analytics-live.service';
import { GeoScheduledReportService } from './geo-scheduled-report.service';
import { AuthModule } from '../auth/auth.module';
import { ProfileModule } from '../profile/profile.module';

@Module({
  imports: [
    AuthModule,
    ProfileModule,
    HttpModule.register({ timeout: 8000, maxRedirects: 3 }),
    BullModule.registerQueue({ name: ANALYTICS_QUEUE }),
  ],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    GeoResolverService,
    SessionTrackingService,
    DeepAnalyticsService,
    CsvExportService,
    GeoRollupService,
    GeoBackfillService,
    GeoRedisCacheService,
    AnalyticsGeoProcessor,
    AnalyticsGeoJobsService,
    AnalyticsSocketGateway,
    AnalyticsLiveService,
    GeoScheduledReportService,
  ],
  exports: [
    AnalyticsService,
    SessionTrackingService,
    GeoResolverService,
    GeoRollupService,
    GeoRedisCacheService,
  ],
})
export class AnalyticsModule {}
