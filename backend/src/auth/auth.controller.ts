import { Controller, Post, Get, Body, UnauthorizedException, UseGuards, Req, Res, BadRequestException, Inject, Optional } from '@nestjs/common';
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
    );

    if (body.referralCode && this.referralService) {
      try {
        await this.referralService.trackSignup(body.referralCode, body.email, result.userId, 'signup_form');
      } catch {}
    }

    return result;
  }

  @Post('login')
  async login(@Body() body: LoginDto) {
    return this.authService.loginWithPassword(body.email, body.password);
  }

  @Post('google')
  async googleSignIn(@Body() body: GoogleSignInDto) {
    const { accessToken, user } = await this.authService.verifyGoogleToken(body.credential);
    return { accessToken, user };
  }

  /** SPA flow: frontend sends LinkedIn authorization code, backend exchanges it */
  @Post('linkedin')
  async linkedInSignIn(@Body() body: LinkedInSignInDto) {
    const result = await this.authService.verifyLinkedInCode(body.code);

    if (body.referralCode && this.referralService) {
      try {
        await this.referralService.trackSignup(body.referralCode, result.user.email, result.user.id, 'linkedin_sso');
      } catch {}
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
    if (!userId) throw new BadRequestException('Not authenticated');
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, tenantId: true, planId: true, billingCycle: true, sectorFocus: true, isAdmin: true, trainerRequested: true, trainerApprovedAt: true },
    });
    if (!user) throw new UnauthorizedException('User not found');
    return user;
  }

  @Post('refresh')
  @UseGuards(AuthGuard('jwt'))
  async refresh(@Req() req: { user?: { sub?: string } }) {
    const userId = req.user?.sub;
    if (!userId) throw new BadRequestException('Not authenticated');
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
