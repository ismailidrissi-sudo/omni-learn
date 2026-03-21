import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { SessionTrackingService } from './session-tracking.service';
import { DeepAnalyticsService } from './deep-analytics.service';
import { CsvExportService } from './csv-export.service';
import { AnalyticsController } from './analytics.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, SessionTrackingService, DeepAnalyticsService, CsvExportService],
  exports: [AnalyticsService, SessionTrackingService],
})
export class AnalyticsModule {}
