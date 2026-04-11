import { Controller, Post, Get, Body, UnauthorizedException, UseGuards, Req, Res, BadRequestException, Inject, Optional, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  SignUpDto,
  LoginDto,
  GoogleSignInDto,
  LinkedInSignInDto,
  PasswordResetRequestDto,
  PasswordResetConfirmDto,
} from '../dto/auth.dto';
import { ReferralService } from '../referral/referral.service';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
    @Optional() @Inject(ReferralService) private readonly referralService?: ReferralService,
  ) {}

  @Post('signup')
  async signUp(@Body() body: SignUpDto) {
    const result = await this.authService.signUp(
      body.email,
      body.password,
      body.name ?? '',
      body.trainerRequested ?? false,
      body.tenantSlug,
      body.planId,
    );

    if (body.referralCode && this.referralService) {
      try {
        await this.referralService.trackSignup(body.referralCode, body.email, result.userId, 'signup_form');
      } catch (err) {
        this.logger.warn(`Referral trackSignup failed (signup_form): ${err}`);
      }
    }

    return result;
  }

  @Post('login')
  async login(@Body() body: LoginDto) {
    return this.authService.loginWithPassword(body.email, body.password);
  }

  @Post('google')
  async googleSignIn(@Body() body: GoogleSignInDto) {
    const { accessToken, user, isNewUser } = await this.authService.verifyGoogleToken(body.credential);
    if (body.referralCode && isNewUser && this.referralService) {
      try {
        await this.referralService.trackSignup(body.referralCode, user.email, user.id, 'google_sso');
      } catch (err) {
        this.logger.warn(`Referral trackSignup failed (google_sso): ${err}`);
      }
    }
    return { accessToken, user };
  }

  /** SPA flow: frontend sends LinkedIn authorization code, backend exchanges it */
  @Post('linkedin')
  async linkedInSignIn(@Body() body: LinkedInSignInDto) {
    const result = await this.authService.verifyLinkedInCode(body.code);

    if (body.referralCode && result.isNewUser && this.referralService) {
      try {
        await this.referralService.trackSignup(body.referralCode, result.user.email, result.user.id, 'linkedin_sso');
      } catch (err) {
        this.logger.warn(`Referral trackSignup failed (linkedin_sso): ${err}`);
      }
    }

    return {
      accessToken: result.accessToken,
      linkedinAccessToken: result.linkedinAccessToken,
      user: result.user,
    };
  }

  /** Server-side OAuth: redirect to LinkedIn authorization page */
  @Get('linkedin')
  @UseGuards(AuthGuard('linkedin'))
  linkedInRedirect() {
    // Passport redirects automatically
  }

  /** Server-side OAuth: LinkedIn redirects back here after user consent */
  @Get('linkedin/callback')
  @UseGuards(AuthGuard('linkedin'))
  async linkedInCallback(
    @Req() req: { user?: { linkedinId: string; email?: string; name?: string; accessToken: string } },
    @Res() res: Response,
  ) {
    if (!req.user) throw new UnauthorizedException('LinkedIn authentication failed');

    const result = await this.authService.loginWithLinkedInProfile(req.user);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const params = new URLSearchParams({
      token: result.accessToken,
      linkedinToken: result.linkedinAccessToken,
    });
    res.redirect(`${frontendUrl}/auth/callback?${params.toString()}`);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async me(@Req() req: { user?: { sub?: string } }) {
    const userId = req.user?.sub;
    if (!userId) throw new UnauthorizedException('Not authenticated');
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        tenantId: true,
        planId: true,
        billingCycle: true,
        sectorFocus: true,
        isAdmin: true,
        trainerRequested: true,
        trainerApprovedAt: true,
        accountStatus: true,
        country: true,
        city: true,
        countryCode: true,
        timezone: true,
      },
    });
    if (!user) throw new UnauthorizedException('User not found');
    const ctx = await this.authService.loadRequestUser(userId);
    if (!ctx) throw new UnauthorizedException('User not found');
    return {
      ...user,
      roles: ctx.rolesRaw,
      permissions: ctx.permissions,
    };
  }

  @Post('refresh')
  @UseGuards(AuthGuard('jwt-refresh'))
  async refresh(@Req() req: { user?: { sub?: string } }) {
    const userId = req.user?.sub;
    if (!userId) throw new UnauthorizedException('Not authenticated');
    const { accessToken } = await this.authService.refreshToken(userId);
    return { accessToken };
  }

  @Post('resend-verification')
  async resendVerification(@Body() body: { email: string }) {
    if (!body?.email) throw new BadRequestException('Email required');
    return this.authService.resendVerification(body.email);
  }

  @Post('password-reset/request')
  async requestPasswordReset(@Body() body: PasswordResetRequestDto) {
    return this.authService.requestPasswordReset(body.email);
  }

  @Post('password-reset/confirm')
  async confirmPasswordReset(@Body() body: PasswordResetConfirmDto) {
    return this.authService.confirmPasswordReset(body.email, body.token, body.newPassword);
  }

  @Post('magic-link')
  async redeemMagicLink(@Body() body: { email: string; token: string }) {
    if (!body?.email || !body?.token) {
      throw new BadRequestException('email and token are required');
    }
    return this.authService.redeemMagicLink(body.email, body.token);
  }

  @Post('dev-login')
  async devLogin(@Body() body: LoginDto) {
    if (process.env.NODE_ENV === 'production') {
      throw new UnauthorizedException('Dev login is disabled in production');
    }
    if (!body?.email || !body?.password) {
      throw new UnauthorizedException('Email and password required');
    }
    const { accessToken, user } = await this.authService.devLogin(body.email, body.password);
    return { accessToken, user };
  }
}
