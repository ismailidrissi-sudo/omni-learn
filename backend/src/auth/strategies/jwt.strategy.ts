import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService, JwtPayload } from '../auth.service';

/**
 * JWT Strategy — Validates Keycloak-issued JWTs
 * Set KEYCLOAK_JWKS_URI or JWT_SECRET for validation
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || process.env.KEYCLOAK_PUBLIC_KEY || 'dev-secret',
      algorithms: ['RS256', 'HS256'],
    });
  }

  async validate(payload: JwtPayload) {
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
