import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { MailerModule } from './mailer/mailer.module';
import { AuthModule } from './auth/auth.module';
import { ProfileModule } from './profile/profile.module';
import { DomainsModule } from './domains/domains.module';
import { ContentModule } from './content/content.module';
import { LearningPathModule } from './learning-path/learning-path.module';
import { CertificateModule } from './certificate/certificate.module';
import { GamificationModule } from './gamification/gamification.module';
import { ForumModule } from './forum/forum.module';
import { ReviewModule } from './review/review.module';
import { CompanyModule } from './company/company.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ScimModule } from './scim/scim.module';
import { IntelligenceModule } from './intelligence/intelligence.module';
import { MicrolearningModule } from './microlearning/microlearning.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { SitePagesModule } from './site-pages/site-pages.module';
import { ReferralModule } from './referral/referral.module';
import { NotificationModule } from './notification/notification.module';

@Module({
  imports: [
    PrismaModule,
    MailerModule,
    AuthModule,
    ProfileModule,
    DomainsModule,
    ContentModule,
    LearningPathModule,
    CertificateModule,
    GamificationModule,
    ForumModule,
    ReviewModule,
    CompanyModule,
    AnalyticsModule,
    ScimModule,
    IntelligenceModule,
    MicrolearningModule,
    SubscriptionModule,
    SitePagesModule,
    ReferralModule,
    NotificationModule,
  ],
})
export class AppModule {}
