import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as UAParser from 'ua-parser-js';
import * as geoip from 'geoip-lite';
import { DeviceType } from '@prisma/client';

@Injectable()
export class SessionTrackingService {
  constructor(private readonly prisma: PrismaService) {}

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

    let geo: { country?: string; countryCode?: string; city?: string; region?: string; latitude?: number; longitude?: number } = {};
    if (ip) {
      const cleanIp = ip.split(',')[0].trim();
      const lookup = geoip.lookup(cleanIp);
      if (lookup) {
        geo = {
          country: lookup.country,
          countryCode: lookup.country,
          city: lookup.city,
          region: lookup.region,
          latitude: lookup.ll?.[0],
          longitude: lookup.ll?.[1],
        };
      }
    }

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
        country: geo.country || null,
        countryCode: geo.countryCode || null,
        city: geo.city || null,
        region: geo.region || null,
        latitude: geo.latitude || null,
        longitude: geo.longitude || null,
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
