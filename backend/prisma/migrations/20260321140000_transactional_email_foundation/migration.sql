-- Transactional email foundation: templates i18n, queue extensions, audit log, branding, campaigns

-- Extend email_templates (drop slug-only unique, add language + version)
ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "language" VARCHAR(10) NOT NULL DEFAULT 'en';
ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "eventType" VARCHAR(100);
ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
DROP INDEX IF EXISTS "email_templates_slug_key";
CREATE UNIQUE INDEX IF NOT EXISTS "email_templates_slug_language_version_key" ON "email_templates"("slug", "language", "version");

-- Extend email_queue
ALTER TABLE "email_queue" ADD COLUMN IF NOT EXISTS "idempotencyKey" VARCHAR(255);
ALTER TABLE "email_queue" ADD COLUMN IF NOT EXISTS "eventType" VARCHAR(100);
ALTER TABLE "email_queue" ADD COLUMN IF NOT EXISTS "scheduledAfter" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "email_queue_idempotencyKey_key" ON "email_queue"("idempotencyKey");

-- Email provider config (future admin UI)
CREATE TABLE IF NOT EXISTS "email_provider_config" (
    "id" TEXT NOT NULL,
    "providerType" VARCHAR(20) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "displayName" VARCHAR(200) NOT NULL,
    "smtpHost" TEXT,
    "smtpPort" INTEGER DEFAULT 587,
    "smtpUsername" TEXT,
    "smtpPasswordEncrypted" TEXT,
    "smtpUseTls" BOOLEAN DEFAULT true,
    "smtpUseSsl" BOOLEAN DEFAULT false,
    "smtpFromEmail" TEXT,
    "smtpFromName" TEXT,
    "resendApiKeyEncrypted" TEXT,
    "resendFromDomain" TEXT,
    "sendLimitPerMinute" INTEGER NOT NULL DEFAULT 10,
    "sendLimitPerHour" INTEGER NOT NULL DEFAULT 100,
    "sendLimitPerDay" INTEGER NOT NULL DEFAULT 500,
    "emailsSentThisMinute" INTEGER NOT NULL DEFAULT 0,
    "emailsSentThisHour" INTEGER NOT NULL DEFAULT 0,
    "emailsSentToday" INTEGER NOT NULL DEFAULT 0,
    "minuteResetAt" TIMESTAMP(3),
    "hourResetAt" TIMESTAMP(3),
    "dayResetAt" TIMESTAMP(3),
    "lastTestAt" TIMESTAMP(3),
    "lastTestStatus" VARCHAR(20),
    "lastTestError" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_provider_config_pkey" PRIMARY KEY ("id")
);

-- Audit log
CREATE TABLE IF NOT EXISTS "email_logs" (
    "id" TEXT NOT NULL,
    "recipientUserId" TEXT,
    "recipientEmail" VARCHAR(255) NOT NULL,
    "eventType" VARCHAR(100) NOT NULL,
    "templateSlug" VARCHAR(100),
    "templateLanguage" VARCHAR(10) NOT NULL DEFAULT 'en',
    "subject" VARCHAR(500) NOT NULL,
    "brandingSnapshot" JSONB,
    "language" VARCHAR(10) NOT NULL DEFAULT 'en',
    "provider" VARCHAR(50) NOT NULL DEFAULT 'resend',
    "providerMessageId" VARCHAR(255),
    "status" VARCHAR(30) NOT NULL DEFAULT 'queued',
    "errorMessage" TEXT,
    "metadata" JSONB,
    "idempotencyKey" VARCHAR(255),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "queueId" TEXT,
    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_logs_idempotencyKey_key" ON "email_logs"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "email_logs_queueId_key" ON "email_logs"("queueId");
CREATE INDEX IF NOT EXISTS "email_logs_recipientUserId_idx" ON "email_logs"("recipientUserId");
CREATE INDEX IF NOT EXISTS "email_logs_eventType_idx" ON "email_logs"("eventType");
CREATE INDEX IF NOT EXISTS "email_logs_status_idx" ON "email_logs"("status");

ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "email_queue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Tenant email branding overrides
CREATE TABLE IF NOT EXISTS "email_branding" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "logoUrl" TEXT,
    "primaryColor" VARCHAR(16) NOT NULL DEFAULT '#6366F1',
    "secondaryColor" VARCHAR(16) NOT NULL DEFAULT '#1E1B4B',
    "accentColor" VARCHAR(16) NOT NULL DEFAULT '#F59E0B',
    "textColor" VARCHAR(16) NOT NULL DEFAULT '#1F2937',
    "backgroundColor" VARCHAR(16) NOT NULL DEFAULT '#FFFFFF',
    "surfaceColor" VARCHAR(16) NOT NULL DEFAULT '#F9FAFB',
    "borderRadius" VARCHAR(16) NOT NULL DEFAULT '8px',
    "fontFamily" TEXT NOT NULL DEFAULT 'Inter, system-ui, sans-serif',
    "fontFamilyAr" TEXT NOT NULL DEFAULT 'Noto Sans Arabic, Segoe UI, Arial, sans-serif',
    "buttonStyle" JSONB NOT NULL DEFAULT '{"borderRadius": "8px", "padding": "12px 24px", "fontWeight": "600"}',
    "senderName" VARCHAR(255) NOT NULL DEFAULT 'OmniLearn',
    "senderEmail" VARCHAR(255) NOT NULL DEFAULT 'noreply@omnilearn.space',
    "replyToEmail" VARCHAR(255),
    "footerText" TEXT,
    "footerLinks" JSONB,
    "customCss" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_branding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_branding_tenantId_key" ON "email_branding"("tenantId");
ALTER TABLE "email_branding" ADD CONSTRAINT "email_branding_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "user_content_interactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "contentType" VARCHAR(50) NOT NULL,
    "interactionType" VARCHAR(50) NOT NULL,
    "interactionCount" INTEGER NOT NULL DEFAULT 1,
    "firstInteractionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastInteractionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_content_interactions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "user_content_interactions_userId_idx" ON "user_content_interactions"("userId");
CREATE INDEX IF NOT EXISTS "user_content_interactions_contentId_contentType_idx" ON "user_content_interactions"("contentId", "contentType");
ALTER TABLE "user_content_interactions" ADD CONSTRAINT "user_content_interactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "email_schedules" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "scheduleType" VARCHAR(50) NOT NULL,
    "eventTrigger" VARCHAR(100),
    "cronExpression" VARCHAR(100),
    "targetAudience" JSONB NOT NULL,
    "emailEventType" VARCHAR(100) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdById" TEXT,
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_schedules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "email_schedules_tenantId_idx" ON "email_schedules"("tenantId");
ALTER TABLE "email_schedules" ADD CONSTRAINT "email_schedules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "email_campaigns" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "senderRole" VARCHAR(50) NOT NULL,
    "tenantId" TEXT,
    "targetFilter" JSONB,
    "status" VARCHAR(30) NOT NULL DEFAULT 'draft',
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "rateLimitedCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_campaigns_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "email_campaigns_tenantId_idx" ON "email_campaigns"("tenantId");
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "user_email_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" VARCHAR(100) NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_email_preferences_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_email_preferences_userId_eventType_key" ON "user_email_preferences"("userId", "eventType");
ALTER TABLE "user_email_preferences" ADD CONSTRAINT "user_email_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "email_queue_scheduledAfter_idx" ON "email_queue"("scheduledAfter");
