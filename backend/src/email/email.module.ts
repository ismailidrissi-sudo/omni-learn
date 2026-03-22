import { Module, Global } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailProcessorService } from './email-processor.service';
import { EmailConfigService } from './email-config.service';
import { ResendClientService } from './resend-client.service';
import { RateLimiterService } from './rate-limiter.service';
import { EmailAdminController } from './email-admin.controller';
import { EmailCampaignAdminController } from './campaigns/email-campaign-admin.controller';
import { EmailCampaignCompanyController } from './campaigns/email-campaign-company.controller';
import { EmailCampaignService } from './campaigns/email-campaign.service';
import { EmailCampaignSchedulerService } from './campaigns/email-campaign-scheduler.service';
import { EmailScheduleService } from './schedules/email-schedule.service';
import { EmailScheduleSchedulerService } from './schedules/email-schedule-scheduler.service';
import { EmailDigestService } from './email-digest.service';
import { EmailScheduleAdminController } from './schedules/email-schedule-admin.controller';
import { EmailScheduleCompanyController } from './schedules/email-schedule-company.controller';
import { ResendWebhookController } from './resend-webhook.controller';
import { ResendWebhookService } from './resend-webhook.service';
import { ResendEmailProvider } from './providers/resend-email.provider';
import { SmtpEmailProvider } from './providers/smtp-email.provider';
import { BrandingResolverService } from './templates/branding-resolver.service';
import { TemplateLoaderService } from './templates/template-loader.service';
import { TemplateEngineService } from './templates/template-engine.service';
import { TransactionalEmailService } from './transactional-email.service';
import { NewContentPublisherService } from './new-content-publisher.service';
import { EmailProviderConfigService } from './email-provider-config.service';
import { EmailProviderConfigController } from './email-provider-config.controller';
import { EmailBrandingController } from './email-branding.controller';
import { EmailI18nService } from './email-i18n.service';
import { SuggestionEngineService } from './suggestions/suggestion-engine.service';
import { SuggestionSchedulerService } from './suggestions/suggestion-scheduler.service';
import { SuggestionConfigService } from './suggestions/suggestion-config.service';
import { SuggestionController } from './suggestions/suggestion.controller';
import { UnsubscribeService } from './unsubscribe.service';
import { UnsubscribeController } from './unsubscribe.controller';

@Global()
@Module({
  controllers: [
    EmailAdminController,
    EmailCampaignAdminController,
    EmailCampaignCompanyController,
    EmailScheduleAdminController,
    EmailScheduleCompanyController,
    EmailProviderConfigController,
    EmailBrandingController,
    SuggestionController,
    UnsubscribeController,
  ],
  providers: [
    EmailCampaignService,
    EmailCampaignSchedulerService,
    EmailScheduleService,
    EmailScheduleSchedulerService,
    EmailDigestService,
    ResendWebhookService,
    EmailService,
    EmailProcessorService,
    EmailConfigService,
    ResendClientService,
    ResendEmailProvider,
    SmtpEmailProvider,
    BrandingResolverService,
    TemplateLoaderService,
    TemplateEngineService,
    TransactionalEmailService,
    NewContentPublisherService,
    RateLimiterService,
    EmailProviderConfigService,
    EmailI18nService,
    SuggestionEngineService,
    SuggestionSchedulerService,
    SuggestionConfigService,
    UnsubscribeService,
  ],
  exports: [
    EmailService,
    EmailConfigService,
    EmailProviderConfigService,
    BrandingResolverService,
    TemplateLoaderService,
    TemplateEngineService,
    TransactionalEmailService,
    NewContentPublisherService,
    EmailI18nService,
  ],
})
export class EmailModule {}
