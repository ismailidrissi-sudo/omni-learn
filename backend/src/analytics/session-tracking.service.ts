import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as UAParser from 'ua-parser-js';
import { DeviceType } from '@prisma/client';
import { GeoResolverService } from './geo-resolver.service';
import { AnalyticsLiveService } from './analytics-live.service';

function accessDeviceType(userAgent: string | null | undefined): string {
  const ua = (userAgent || '').toLowerCase();
  if (/iphone|ipad|ipod|ios\b/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'web';
}

@Injectable()
export class SessionTrackingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geoResolver: GeoResolverService,
    private readonly analyticsLive: AnalyticsLiveService,
  ) {}

  async startSession(
    userId: string,
    ip: string | undefined,
    userAgent: string | undefined,
    body: {
      fingerprint?: string;
      screenResolution?: string;
      language?: string;
      tenantId?: string;
    },
  ) {
    const ua = new UAParser.UAParser(userAgent || '');
    const browser = ua.getBrowser();
    const os = ua.getOS();
    const device = ua.getDevice();

    let deviceType: DeviceType = DeviceType.DESKTOP;
    if (device.type === 'mobile') deviceType = DeviceType.MOBILE;
    else if (device.type === 'tablet') deviceType = DeviceType.TABLET;
    else if (!device.type) deviceType = DeviceType.DESKTOP;

    const geo = await this.geoResolver.resolve(ip, userId);

    const session = await this.prisma.userSession.create({
      data: {
        userId,
        tenantId: body.tenantId || null,
        fingerprint: body.fingerprint || null,
        ipAddress: ip || null,
        userAgent: userAgent || null,
        deviceType,
        browserName: browser.name || null,
        browserVersion: browser.version || null,
        osName: os.name || null,
        osVersion: os.version || null,
        screenResolution: body.screenResolution || null,
        language: body.language || null,
        country: geo.country,
        countryCode: geo.countryCode,
        city: geo.city,
        region: geo.region,
        latitude: geo.latitude,
        longitude: geo.longitude,
        continent: geo.continent,
      },
    });

    return { sessionId: session.id };
  }

  async heartbeat(sessionId: string, userId: string) {
    const session = await this.prisma.userSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) return { ok: false };

    const elapsed = Math.floor((Date.now() - session.startedAt.getTime()) / 1000);
    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: { durationSeconds: elapsed, isActive: true },
    });
    return { ok: true };
  }

  async endSession(sessionId: string, userId: string) {
    const session = await this.prisma.userSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) return { ok: false };

    const elapsed = Math.floor((Date.now() - session.startedAt.getTime()) / 1000);
    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: { endedAt: new Date(), durationSeconds: elapsed, isActive: false },
    });
    return { ok: true };
  }

  async recordPageView(
    sessionId: string,
    userId: string,
    body: { path: string; title?: string; contentId?: string; contentType?: string; durationSeconds?: number },
  ) {
    await this.prisma.pageView.create({
      data: {
        sessionId,
        userId,
        path: body.path,
        title: body.title || null,
        contentId: body.contentId || null,
        contentType: body.contentType || null,
        durationSeconds: body.durationSeconds || 0,
      },
    });

    if (body.contentId) {
      const session = await this.prisma.userSession.findFirst({
        where: { id: sessionId, userId },
      });
      if (session) {
        let geo = {
          country: session.country,
          countryCode: session.countryCode,
          city: session.city,
          region: session.region,
          latitude: session.latitude,
          longitude: session.longitude,
          continent: session.continent,
        };
        if (!geo.country && !geo.countryCode) {
          const resolved = await this.geoResolver.resolve(session.ipAddress || undefined, userId);
          geo = {
            country: resolved.country,
            countryCode: resolved.countryCode,
            city: resolved.city,
            region: resolved.region,
            latitude: resolved.latitude,
            longitude: resolved.longitude,
            continent: resolved.continent,
          };
        }
        const log = await this.prisma.contentAccessLog.create({
          data: {
            userId,
            contentId: body.contentId,
            deviceType: accessDeviceType(session.userAgent),
            ipAddress: session.ipAddress,
            userAgent: session.userAgent,
            country: geo.country,
            countryCode: geo.countryCode,
            city: geo.city,
            region: geo.region,
            latitude: geo.latitude,
            longitude: geo.longitude,
            continent: geo.continent,
          },
          include: { content: { select: { title: true } }, user: { select: { name: true } } },
        });
        this.analyticsLive.contentAccessed({
          tenantId: session.tenantId,
          userId,
          userName: log.user.name,
          city: log.city || '',
          country: log.country || '',
          contentTitle: log.content.title,
          at: log.createdAt,
        });
      }
    }

    return { ok: true };
  }

  async cleanupStaleSessions() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const stale = await this.prisma.userSession.findMany({
      where: { isActive: true, startedAt: { lt: oneHourAgo } },
      select: { id: true, startedAt: true },
    });

    for (const s of stale) {
      const duration = Math.floor((oneHourAgo.getTime() - s.startedAt.getTime()) / 1000);
      await this.prisma.userSession.update({
        where: { id: s.id },
        data: { isActive: false, endedAt: oneHourAgo, durationSeconds: duration },
      });
    }
    return { cleaned: stale.length };
  }
}
