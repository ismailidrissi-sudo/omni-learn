import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService, JwtPayload } from '../auth.service';

/** Max time after access-token `exp` during which refresh is still allowed (stolen tokens cannot refresh forever). */
const MAX_REFRESH_AFTER_EXPIRY_SEC = 14 * 24 * 60 * 60;

/**
 * Same signing key as JwtStrategy, but accepts expired tokens so POST /auth/refresh can rotate them.
 * Signature and `sub` are still verified by passport-jwt.
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: true,
      secretOrKey: (() => {
        const secret = process.env.JWT_SECRET || process.env.KEYCLOAK_PUBLIC_KEY;
        if (!secret && process.env.NODE_ENV === 'production') {
          throw new Error('JWT_SECRET or KEYCLOAK_PUBLIC_KEY is required in production');
        }
        return secret || 'dev-secret-local-only';
      })(),
      algorithms: ['RS256', 'HS256'],
    });
  }

  async validate(payload: JwtPayload & { exp?: number }) {
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === 'number' && payload.exp + MAX_REFRESH_AFTER_EXPIRY_SEC < now) {
      throw new UnauthorizedException('Session expired');
    }
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token');
    }

    const roles = this.authService.getRolesFromPayload(payload);
    const tenantId = this.authService.getTenantId(payload);

    return {
      sub: payload.sub,
      email: payload.email ?? payload.preferred_username,
      roles,
      tenantId,
    };
  }
}
