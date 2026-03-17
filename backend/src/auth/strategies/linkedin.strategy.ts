import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-linkedin-oauth2';

@Injectable()
export class LinkedInStrategy extends PassportStrategy(Strategy, 'linkedin') {
  constructor() {
    const clientID = process.env.LINKEDIN_CLIENT_ID || 'disabled';
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET || 'disabled';
    const serverCallbackUrl =
      process.env.LINKEDIN_SERVER_CALLBACK_URL ||
      (process.env.FRONTEND_URL
        ? `${process.env.FRONTEND_URL}/api/auth/linkedin/callback`
        : 'http://localhost:4000/auth/linkedin/callback');
    super({
      clientID,
      clientSecret,
      callbackURL: serverCallbackUrl,
      scope: ['openid', 'profile', 'email'],
      state: true,
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: {
      id: string;
      displayName?: string;
      emails?: { value: string }[];
      photos?: { value: string }[];
      _json?: Record<string, unknown>;
    },
  ) {
    return {
      linkedinId: profile.id,
      email: profile.emails?.[0]?.value,
      name: profile.displayName,
      picture: profile.photos?.[0]?.value,
      accessToken,
      refreshToken,
    };
  }
}
