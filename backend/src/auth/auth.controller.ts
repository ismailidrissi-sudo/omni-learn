import { Controller, Post, Get, Body, UnauthorizedException, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Auth Controller — Google Sign-In + JWT issuance + /me
 * omnilearn.space | Afflatus Consulting Group
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('signup')
  async signUp(@Body() body: { email: string; password: string; name?: string }) {
    if (!body?.email || !body?.password) {
      throw new UnauthorizedException('Email and password required');
    }
    return this.authService.signUp(body.email, body.password, body.name ?? '');
  }

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    if (!body?.email || !body?.password) {
      throw new UnauthorizedException('Email and password required');
    }
    return this.authService.loginWithPassword(body.email, body.password);
  }

  @Post('google')
  async googleSignIn(@Body() body: { credential: string }) {
    if (!body?.credential) {
      throw new UnauthorizedException('Missing Google credential');
    }
    const { accessToken, user } = await this.authService.verifyGoogleToken(body.credential);
    return { accessToken, user };
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async me(@Req() req: { user?: { sub?: string } }) {
    const userId = req.user?.sub;
    if (!userId) throw new BadRequestException('Not authenticated');
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, tenantId: true },
    });
    if (!user) throw new UnauthorizedException('User not found');
    return user;
  }

  @Post('dev-login')
  async devLogin(@Body() body: { email: string; password: string }) {
    if (!body?.email || !body?.password) {
      throw new UnauthorizedException('Email and password required');
    }
    const { accessToken, user } = await this.authService.devLogin(body.email, body.password);
    return { accessToken, user };
  }
}
