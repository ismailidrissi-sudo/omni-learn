import { Module, forwardRef } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { LinkedInStrategy } from './strategies/linkedin.strategy';
import { RbacGuard } from './guards/rbac.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { OptionalJwtGuard } from './guards/optional-jwt.guard';
import { ReferralModule } from '../referral/referral.module';

@Module({
  controllers: [AuthController],
  imports: [
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: (() => {
        const secret = process.env.JWT_SECRET;
        if (!secret && process.env.NODE_ENV === 'production') {
          throw new Error('JWT_SECRET environment variable is required in production');
        }
        return secret || 'dev-secret-local-only';
      })(),
      // Longer access window reduces disconnects when refresh is delayed (background tabs, brief offline).
      signOptions: { expiresIn: '8h' },
    }),
    forwardRef(() => ReferralModule),
  ],
  providers: [AuthService, JwtStrategy, JwtRefreshStrategy, LinkedInStrategy, RbacGuard, OptionalJwtGuard],
  exports: [AuthService, RbacGuard, OptionalJwtGuard],
})
export class AuthModule {}
