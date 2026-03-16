import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-linkedin-oauth2';

@Injectable()
export class LinkedInStrategy extends PassportStrategy(Strategy, 'linkedin') {
  constructor() {
    super({
      clientID: process.env.LINKEDIN_CLIENT_ID || '',
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET || '',
      callbackURL: process.env.LINKEDIN_CALLBACK_URL || 'http://localhost:4000/auth/linkedin/callback',
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
