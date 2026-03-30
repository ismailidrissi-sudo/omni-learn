import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { AuthService } from '../auth/auth.service';
import { RbacRole } from '../constants/rbac.constant';
import { PrismaService } from '../prisma/prisma.service';

const ANALYTICS_ROLES = new Set<string>([
  RbacRole.SUPER_ADMIN,
  RbacRole.COMPANY_ADMIN,
  RbacRole.COMPANY_MANAGER,
]);

function accessTokenSecret(): string {
  return (
    process.env.JWT_SECRET ||
    process.env.KEYCLOAK_PUBLIC_KEY ||
    'dev-secret-local-only'
  );
}

@WebSocketGateway({
  namespace: '/ws/analytics',
  cors: { origin: true, credentials: true },
})
export class AnalyticsSocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy
{
  private readonly log = new Logger(AnalyticsSocketGateway.name);
  private pulseTimer: ReturnType<typeof setInterval> | null = null;

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.pulseTimer = setInterval(() => void this.emitGeoPulse(), 60_000);
  }

  onModuleDestroy() {
    if (this.pulseTimer) clearInterval(this.pulseTimer);
  }

  async handleConnection(client: Socket) {
    try {
      const raw =
        (client.handshake.auth?.token as string | undefined) ||
        (typeof client.handshake.headers.authorization === 'string'
          ? client.handshake.headers.authorization.replace(/^Bearer\s+/i, '')
          : '');
      if (!raw) {
        client.disconnect(true);
        return;
      }
      const decoded = jwt.verify(raw, accessTokenSecret(), {
        algorithms: ['HS256', 'RS256'],
      }) as { sub: string };
      const user = await this.auth.loadRequestUser(decoded.sub);
      if (!user?.roles?.length) {
        client.disconnect(true);
        return;
      }
      const allowed = user.roles.some((r) => ANALYTICS_ROLES.has(r));
      if (!allowed) {
        client.disconnect(true);
        return;
      }
      if (user.roles.includes(RbacRole.SUPER_ADMIN)) {
        await client.join('super');
      }
      if (user.tenantId) {
        await client.join(`tenant:${user.tenantId}`);
      }
    } catch (e) {
      this.log.warn(`WS analytics connect failed: ${e}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(_client: Socket) {
    /* no-op */
  }

  emitLiveActivity(
    tenantId: string | null | undefined,
    payload: Record<string, unknown>,
  ) {
    if (!this.server) return;
    this.server.to('super').emit('analytics:live_activity', payload);
    if (tenantId) {
      this.server.to(`tenant:${tenantId}`).emit('analytics:live_activity', payload);
    }
  }

  private async emitGeoPulse() {
    if (!this.server) return;
    try {
      const rows = await this.prisma.userSession.groupBy({
        by: ['countryCode'],
        where: { isActive: true, countryCode: { not: null } },
        _count: { id: true },
      });
      const payload = {
        at: new Date().toISOString(),
        countries: rows.map((r) => ({
          country_code: r.countryCode,
          active_now: r._count.id,
        })),
      };
      this.server.emit('analytics:geo_pulse', payload);
    } catch (e) {
      this.log.warn(`geo_pulse: ${e}`);
    }
  }
}
