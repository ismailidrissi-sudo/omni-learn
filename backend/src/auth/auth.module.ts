import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RbacGuard } from './guards/rbac.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { MailerModule } from '../mailer/mailer.module';
import { OptionalJwtGuard } from './guards/optional-jwt.guard';

@Module({
  controllers: [AuthController],
  imports: [
    PrismaModule,
    MailerModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  providers: [AuthService, JwtStrategy, RbacGuard, OptionalJwtGuard],
  exports: [AuthService, RbacGuard, OptionalJwtGuard],
})
export class AuthModule {}
