import { Injectable } from '@nestjs/common';
import { AnalyticsSocketGateway } from './analytics-socket.gateway';

@Injectable()
export class AnalyticsLiveService {
  constructor(private readonly gateway: AnalyticsSocketGateway) {}

  contentAccessed(params: {
    tenantId: string | null | undefined;
    userId: string;
    userName: string;
    city: string;
    country: string;
    contentTitle: string;
    at: Date;
  }) {
    try {
      this.gateway?.emitLiveActivity(params.tenantId, {
        userId: params.userId,
        userName: params.userName,
        city: params.city,
        country: params.country,
        action: 'viewed content',
        contentTitle: params.contentTitle,
        timestamp: params.at.toISOString(),
      });
    } catch {
      /* ignore */
    }
  }
}
