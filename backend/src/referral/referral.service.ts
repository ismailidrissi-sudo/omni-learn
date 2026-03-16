import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService } from '../mailer/mailer.service';

@Injectable()
export class ReferralService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
  ) {}

  private generateCode(): string {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
  }

  async getOrCreateCode(userId: string, label?: string) {
    const existing = await this.prisma.referralCode.findFirst({
      where: { userId, isActive: true },
    });
    if (existing) return existing;

    return this.prisma.referralCode.create({
      data: {
        userId,
        code: this.generateCode(),
        label: label ?? 'My referral link',
      },
    });
  }

  async createCode(userId: string, label?: string) {
    return this.prisma.referralCode.create({
      data: {
        userId,
        code: this.generateCode(),
        label: label ?? null,
      },
    });
  }

  async getUserCodes(userId: string) {
    return this.prisma.referralCode.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { referrals: true, invitations: true } },
      },
    });
  }

  async deactivateCode(userId: string, codeId: string) {
    const code = await this.prisma.referralCode.findUnique({ where: { id: codeId } });
    if (!code || code.userId !== userId) {
      throw new ForbiddenException('Code not found or not yours');
    }
    return this.prisma.referralCode.update({
      where: { id: codeId },
      data: { isActive: false },
    });
  }

  async resolveCode(code: string) {
    const referralCode = await this.prisma.referralCode.findUnique({
      where: { code },
      select: { id: true, userId: true, isActive: true, code: true },
    });
    if (!referralCode || !referralCode.isActive) return null;
    return referralCode;
  }

  async trackSignup(referralCodeStr: string, referredEmail: string, referredUserId: string, channel?: string) {
    const referralCode = await this.resolveCode(referralCodeStr);
    if (!referralCode) return null;

    if (referralCode.userId === referredUserId) return null;

    const existing = await this.prisma.referral.findUnique({
      where: { referralCodeId_referredEmail: { referralCodeId: referralCode.id, referredEmail } },
    });

    if (existing) {
      return this.prisma.referral.update({
        where: { id: existing.id },
        data: {
          referredUserId,
          status: 'SIGNED_UP',
          signedUpAt: new Date(),
        },
      });
    }

    return this.prisma.referral.create({
      data: {
        referralCodeId: referralCode.id,
        referrerId: referralCode.userId,
        referredUserId,
        referredEmail,
        status: 'SIGNED_UP',
        signedUpAt: new Date(),
        channel: channel ?? 'link',
      },
    });
  }

  async convertReferral(referredUserId: string) {
    const referral = await this.prisma.referral.findFirst({
      where: { referredUserId, status: 'SIGNED_UP' },
    });
    if (!referral) return null;

    const updated = await this.prisma.referral.update({
      where: { id: referral.id },
      data: {
        status: 'CONVERTED',
        convertedAt: new Date(),
      },
    });

    await this.processReward(referral.referrerId, updated.id);
    return updated;
  }

  private async processReward(referrerId: string, referralId: string) {
    const referralCount = await this.prisma.referral.count({
      where: { referrerId, status: 'CONVERTED' },
    });

    let grantedPlan: 'SPECIALIST' | 'VISIONARY' = 'SPECIALIST';
    let durationDays = 30;

    if (referralCount >= 10) {
      grantedPlan = 'VISIONARY';
      durationDays = 90;
    } else if (referralCount >= 5) {
      grantedPlan = 'VISIONARY';
      durationDays = 30;
    } else if (referralCount >= 3) {
      grantedPlan = 'SPECIALIST';
      durationDays = 60;
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    await this.prisma.referralReward.create({
      data: {
        userId: referrerId,
        referralId,
        rewardType: 'PLAN_UPGRADE',
        grantedPlan,
        durationDays,
        expiresAt,
      },
    });

    await this.prisma.user.update({
      where: { id: referrerId },
      data: { planId: grantedPlan },
    });
  }

  async sendBulkInvitations(
    userId: string,
    contacts: { email: string; name?: string }[],
    referralCodeId?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    if (!user) throw new NotFoundException('User not found');

    let code: { id: string; code: string };
    if (referralCodeId) {
      const existing = await this.prisma.referralCode.findUnique({ where: { id: referralCodeId } });
      if (!existing || existing.userId !== userId) {
        throw new ForbiddenException('Referral code not found');
      }
      code = existing;
    } else {
      code = await this.getOrCreateCode(userId);
    }

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const results = { sent: 0, skipped: 0, errors: 0 };

    for (const contact of contacts) {
      try {
        const existingUser = await this.prisma.user.findUnique({
          where: { email: contact.email },
        });
        if (existingUser) {
          results.skipped++;
          continue;
        }

        const existingInvite = await this.prisma.referralInvitation.findUnique({
          where: {
            referralCodeId_recipientEmail: {
              referralCodeId: code.id,
              recipientEmail: contact.email,
            },
          },
        });
        if (existingInvite) {
          results.skipped++;
          continue;
        }

        await this.prisma.referralInvitation.create({
          data: {
            referralCodeId: code.id,
            senderUserId: userId,
            recipientEmail: contact.email,
            recipientName: contact.name ?? null,
            source: 'bulk_import',
          },
        });

        await this.prisma.referral.upsert({
          where: {
            referralCodeId_referredEmail: {
              referralCodeId: code.id,
              referredEmail: contact.email,
            },
          },
          create: {
            referralCodeId: code.id,
            referrerId: userId,
            referredEmail: contact.email,
            status: 'PENDING',
            channel: 'email_invite',
          },
          update: {},
        });

        const referralUrl = `${baseUrl}/signup?ref=${code.code}`;
        await this.mailer.sendReferralInvitation(
          contact.email,
          contact.name ?? 'there',
          user.name,
          referralUrl,
        );

        results.sent++;
      } catch {
        results.errors++;
      }
    }

    return results;
  }

  async importGmailContacts(accessToken: string): Promise<{ email: string; name?: string }[]> {
    const url = 'https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses&pageSize=1000';
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new BadRequestException('Failed to fetch Gmail contacts. Please re-authorize.');
    }

    const data = await response.json();
    const contacts: { email: string; name?: string }[] = [];

    for (const person of data.connections ?? []) {
      const email = person.emailAddresses?.[0]?.value;
      if (!email) continue;
      const name = person.names?.[0]?.displayName;
      contacts.push({ email, name });
    }

    return contacts;
  }

  /**
   * Import LinkedIn connections using the LinkedIn API.
   *
   * Uses the /v2/connections endpoint (requires r_1st_connections scope)
   * with fallback to the /v2/people search endpoint. Full connections
   * access requires LinkedIn Partnership approval; partial data (name only,
   * no email) is common for non-partner apps.
   *
   * When email is not available for a connection, only name is returned
   * so the frontend can show which contacts lack email addresses.
   */
  async importLinkedInContacts(accessToken: string): Promise<{ email?: string; name?: string; linkedinId?: string; profileUrl?: string }[]> {
    const contacts: { email?: string; name?: string; linkedinId?: string; profileUrl?: string }[] = [];

    const connectionsUrl = 'https://api.linkedin.com/v2/connections?q=viewer&start=0&count=500&projection=(elements*(to~(emailAddress,firstName,lastName,id,publicProfileUrl)))';
    const connectionsResponse = await fetch(connectionsUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });

    if (connectionsResponse.ok) {
      const data = await connectionsResponse.json() as {
        elements?: Array<{
          'to~'?: {
            id?: string;
            emailAddress?: string;
            firstName?: { localized?: Record<string, string>; preferredLocale?: { language: string; country: string } };
            lastName?: { localized?: Record<string, string>; preferredLocale?: { language: string; country: string } };
            publicProfileUrl?: string;
          };
        }>;
      };

      for (const element of data.elements ?? []) {
        const profile = element['to~'];
        if (!profile) continue;

        const firstNameLocale = profile.firstName?.preferredLocale
          ? `${profile.firstName.preferredLocale.language}_${profile.firstName.preferredLocale.country}`
          : undefined;
        const lastNameLocale = profile.lastName?.preferredLocale
          ? `${profile.lastName.preferredLocale.language}_${profile.lastName.preferredLocale.country}`
          : undefined;

        const firstName = firstNameLocale ? profile.firstName?.localized?.[firstNameLocale] : undefined;
        const lastName = lastNameLocale ? profile.lastName?.localized?.[lastNameLocale] : undefined;

        const name = [firstName, lastName].filter(Boolean).join(' ') || undefined;

        contacts.push({
          email: profile.emailAddress || undefined,
          name,
          linkedinId: profile.id || undefined,
          profileUrl: profile.publicProfileUrl || undefined,
        });
      }

      return contacts;
    }

    const userInfoResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userInfoResponse.ok) {
      throw new BadRequestException(
        'Failed to fetch LinkedIn contacts. The access token may have expired or lack the required scopes (r_1st_connections). Please re-authorize.',
      );
    }

    const meResponse = await fetch('https://api.linkedin.com/v2/me?projection=(id,firstName,lastName,profilePicture)', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });

    if (meResponse.ok) {
      const emailResponse = await fetch('https://api.linkedin.com/v2/clientAwareMemberHandles?q=members&projection=(elements*(primary,type,handle~))', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      });

      if (emailResponse.ok) {
        const emailData = await emailResponse.json() as {
          elements?: Array<{ 'handle~'?: { emailAddress?: string } }>;
        };
        const email = emailData.elements?.[0]?.['handle~']?.emailAddress;
        if (email) {
          const meData = await meResponse.json() as {
            id?: string;
            firstName?: { localized?: Record<string, string>; preferredLocale?: { language: string; country: string } };
            lastName?: { localized?: Record<string, string>; preferredLocale?: { language: string; country: string } };
          };

          const fl = meData.firstName?.preferredLocale
            ? `${meData.firstName.preferredLocale.language}_${meData.firstName.preferredLocale.country}`
            : undefined;
          const ll = meData.lastName?.preferredLocale
            ? `${meData.lastName.preferredLocale.language}_${meData.lastName.preferredLocale.country}`
            : undefined;
          const name = [
            fl ? meData.firstName?.localized?.[fl] : undefined,
            ll ? meData.lastName?.localized?.[ll] : undefined,
          ].filter(Boolean).join(' ') || undefined;

          contacts.push({ email, name, linkedinId: meData.id });
        }
      }
    }

    return contacts;
  }

  async getUserDashboard(userId: string) {
    await this.getOrCreateCode(userId, 'My referral link');
    const codes = await this.getUserCodes(userId);
    const primaryCode = codes.find((c) => c.isActive) ?? codes[0];

    const totalReferrals = await this.prisma.referral.count({
      where: { referrerId: userId },
    });

    const conversions = await this.prisma.referral.count({
      where: { referrerId: userId, status: 'CONVERTED' },
    });

    const pending = await this.prisma.referral.count({
      where: { referrerId: userId, status: 'PENDING' },
    });

    const signedUp = await this.prisma.referral.count({
      where: { referrerId: userId, status: 'SIGNED_UP' },
    });

    const activeRewards = await this.prisma.referralReward.findMany({
      where: { userId, status: 'ACTIVE', expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: 'asc' },
    });

    const recentReferrals = await this.prisma.referral.findMany({
      where: { referrerId: userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        referredEmail: true,
        status: true,
        channel: true,
        createdAt: true,
        signedUpAt: true,
        convertedAt: true,
      },
    });

    const invitationsSent = await this.prisma.referralInvitation.count({
      where: { senderUserId: userId },
    });

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    return {
      referralLink: primaryCode ? `${baseUrl}/signup?ref=${primaryCode.code}` : null,
      referralCode: primaryCode?.code ?? null,
      codes,
      stats: {
        totalReferrals,
        conversions,
        pending,
        signedUp,
        conversionRate: totalReferrals > 0 ? Math.round((conversions / totalReferrals) * 100) : 0,
        invitationsSent,
      },
      activeRewards,
      recentReferrals,
    };
  }

  async grantAccessReward(userId: string, plan: string, durationMonths: number, reason?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const durationDays = durationMonths * 30;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    const validPlans = ['EXPLORER', 'SPECIALIST', 'VISIONARY', 'NEXUS'];
    if (!validPlans.includes(plan)) {
      throw new BadRequestException('Invalid plan');
    }

    const reward = await this.prisma.referralReward.create({
      data: {
        userId,
        rewardType: 'ADMIN_GRANT',
        grantedPlan: plan as any,
        durationDays,
        expiresAt,
        metadata: reason ? { reason } : {},
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { planId: plan as any },
    });

    return reward;
  }

  async revokeReward(rewardId: string) {
    const reward = await this.prisma.referralReward.findUnique({ where: { id: rewardId } });
    if (!reward) throw new NotFoundException('Reward not found');

    return this.prisma.referralReward.update({
      where: { id: rewardId },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });
  }

  async expireRewards() {
    const expired = await this.prisma.referralReward.findMany({
      where: { status: 'ACTIVE', expiresAt: { lte: new Date() } },
    });

    for (const reward of expired) {
      await this.prisma.referralReward.update({
        where: { id: reward.id },
        data: { status: 'EXPIRED' },
      });

      const otherActiveReward = await this.prisma.referralReward.findFirst({
        where: {
          userId: reward.userId,
          status: 'ACTIVE',
          expiresAt: { gt: new Date() },
          id: { not: reward.id },
        },
        orderBy: { expiresAt: 'desc' },
      });

      if (!otherActiveReward) {
        await this.prisma.user.update({
          where: { id: reward.userId },
          data: { planId: 'EXPLORER' },
        });
      }
    }

    return { expired: expired.length };
  }
}
