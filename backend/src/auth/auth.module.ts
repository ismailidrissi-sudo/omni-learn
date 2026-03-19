import { Module, forwardRef } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
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
      signOptions: { expiresIn: '1h' },
    }),
    forwardRef(() => ReferralModule),
  ],
  providers: [AuthService, JwtStrategy, LinkedInStrategy, RbacGuard, OptionalJwtGuard],
  exports: [AuthService, RbacGuard, OptionalJwtGuard],
})
export class AuthModule {}
