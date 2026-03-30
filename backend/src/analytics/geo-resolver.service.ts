import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as fs from 'fs';
import * as geoip from 'geoip-lite';
import { Reader, ReaderModel } from '@maxmind/geoip2-node';
import { PrismaService } from '../prisma/prisma.service';
import {
  ResolvedGeo,
  englishCountryNameFromCode,
  continentFromCountryCode,
} from './geo-constants';

@Injectable()
export class GeoResolverService implements OnModuleDestroy {
  private readonly log = new Logger(GeoResolverService.name);
  private maxmindReader: ReaderModel | null = null;
  private maxmindOpenPromise: Promise<void> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
  ) {}

  onModuleDestroy() {
    this.maxmindReader = null;
  }

  private async ensureMaxMind(): Promise<ReaderModel | null> {
    if (this.maxmindReader) return this.maxmindReader;
    const path = process.env.MAXMIND_DB_PATH;
    if (!path || !fs.existsSync(path)) return null;
    if (!this.maxmindOpenPromise) {
      this.maxmindOpenPromise = Reader.open(path)
        .then((r) => {
          this.maxmindReader = r;
          this.log.log(`MaxMind GeoIP reader opened: ${path}`);
        })
        .catch((e) => {
          this.log.warn(`MaxMind open failed: ${e?.message ?? e}`);
          this.maxmindReader = null;
        });
    }
    await this.maxmindOpenPromise;
    return this.maxmindReader;
  }

  private fromMaxMind(ip: string, reader: ReaderModel): ResolvedGeo | null {
    let rec: ReturnType<ReaderModel['city']>;
    try {
      rec = reader.city(ip);
    } catch {
      return null;
    }
    const code = rec.country?.isoCode ?? null;
    const countryName = rec.country?.names?.en ?? englishCountryNameFromCode(code);
    if (!countryName && !code) return null;
    return {
      country: countryName ?? englishCountryNameFromCode(code),
      countryCode: code,
      city: rec.city?.names?.en ?? null,
      region: rec.subdivisions?.[0]?.names?.en ?? null,
      latitude: rec.location?.latitude ?? null,
      longitude: rec.location?.longitude ?? null,
      continent: rec.continent?.names?.en ?? continentFromCountryCode(code),
      source: 'maxmind',
    };
  }

  private async fromIpinfo(ip: string): Promise<ResolvedGeo | null> {
    const token = process.env.IPINFO_TOKEN;
    if (!token) return null;
    try {
      const { data } = await firstValueFrom(
        this.http.get<{
          country?: string;
          city?: string;
          region?: string;
          loc?: string;
        }>(`https://ipinfo.io/${encodeURIComponent(ip)}/json`, {
          params: { token },
          timeout: 5000,
        }),
      );
      const code = data.country?.toUpperCase() ?? null;
      const countryName = englishCountryNameFromCode(code) ?? code;
      let lat: number | null = null;
      let lng: number | null = null;
      if (data.loc) {
        const [a, b] = data.loc.split(',').map((x) => parseFloat(x.trim()));
        if (!Number.isNaN(a) && !Number.isNaN(b)) {
          lat = a;
          lng = b;
        }
      }
      if (!countryName && !code) return null;
      return {
        country: englishCountryNameFromCode(code) ?? countryName,
        countryCode: code,
        city: data.city ?? null,
        region: data.region ?? null,
        latitude: lat,
        longitude: lng,
        continent: continentFromCountryCode(code),
        source: 'ipinfo',
      };
    } catch {
      return null;
    }
  }

  private fromGeoipLite(ip: string): ResolvedGeo | null {
    const lookup = geoip.lookup(ip);
    if (!lookup?.country) return null;
    const code = lookup.country.toUpperCase();
    return {
      country: englishCountryNameFromCode(code),
      countryCode: code,
      city: lookup.city ?? null,
      region: lookup.region ?? null,
      latitude: lookup.ll?.[0] ?? null,
      longitude: lookup.ll?.[1] ?? null,
      continent: continentFromCountryCode(code),
      source: 'geoip_lite',
    };
  }

  /**
   * Priority: user profile (country+city) → MaxMind → ipinfo → geoip-lite.
   */
  async resolve(ip: string | undefined, userId?: string): Promise<ResolvedGeo> {
    const empty: ResolvedGeo = {
      country: null,
      countryCode: null,
      city: null,
      region: null,
      latitude: null,
      longitude: null,
      continent: null,
      source: 'geoip_lite',
    };

    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { country: true, countryCode: true, city: true },
      });
      if (user?.country && user?.city && user?.countryCode) {
        const code = user.countryCode.toUpperCase();
        return {
          country: user.country,
          countryCode: code,
          city: user.city,
          region: null,
          latitude: null,
          longitude: null,
          continent: continentFromCountryCode(code),
          source: 'user_profile',
        };
      }
    }

    const cleanIp = ip?.split(',')[0]?.trim();
    if (!cleanIp || cleanIp === '::1' || cleanIp.startsWith('127.')) {
      return empty;
    }

    const reader = await this.ensureMaxMind();
    if (reader) {
      const mm = this.fromMaxMind(cleanIp, reader);
      if (mm?.country || mm?.countryCode) return mm;
    }

    const info = await this.fromIpinfo(cleanIp);
    if (info?.country || info?.countryCode) return info;

    const lite = this.fromGeoipLite(cleanIp);
    if (lite) return lite;

    return empty;
  }
}
