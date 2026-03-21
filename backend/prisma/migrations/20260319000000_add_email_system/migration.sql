-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'SCHEDULED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "EmailPriorityLevel" AS ENUM ('CRITICAL', 'HIGH', 'NORMAL', 'LOW');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "OverflowStrategy" AS ENUM ('SCHEDULE_NEXT_DAY', 'DROP', 'QUEUE_HOLD');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "email_config" (
    "id" TEXT NOT NULL,
    "provider" VARCHAR(20) NOT NULL DEFAULT 'resend',
    "apiKey" TEXT NOT NULL,
    "apiKeyLastFour" VARCHAR(5),
    "defaultFromName" VARCHAR(100) NOT NULL DEFAULT 'OmniLearn',
    "defaultFromEmail" VARCHAR(255) NOT NULL DEFAULT 'noreply@omnilearn.space',
    "defaultReplyTo" VARCHAR(255),
    "dailySendLimit" INTEGER NOT NULL DEFAULT 100,
    "rateLimitPerSecond" INTEGER NOT NULL DEFAULT 10,
    "overflowStrategy" "OverflowStrategy" NOT NULL DEFAULT 'SCHEDULE_NEXT_DAY',
    "overflowSendHour" INTEGER NOT NULL DEFAULT 6,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastVerifiedAt" TIMESTAMP(3),
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "email_queue" (
    "id" TEXT NOT NULL,
    "toEmail" VARCHAR(255) NOT NULL,
    "toName" VARCHAR(255),
    "fromEmail" VARCHAR(255),
    "fromName" VARCHAR(100),
    "replyTo" VARCHAR(255),
    "subject" VARCHAR(500) NOT NULL,
    "htmlBody" TEXT NOT NULL,
    "textBody" TEXT,
    "emailType" VARCHAR(50) NOT NULL,
    "priority" "EmailPriorityLevel" NOT NULL DEFAULT 'NORMAL',
    "status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledFor" TIMESTAMP(3),
    "dayBucket" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resendId" VARCHAR(100),
    "sentAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "nextRetryAt" TIMESTAMP(3),
    "triggeredBy" VARCHAR(100),
    "userId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "email_daily_stats" (
    "dayBucket" DATE NOT NULL,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "scheduledOverflowCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_daily_stats_pkey" PRIMARY KEY ("dayBucket")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "email_templates" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "subjectTemplate" VARCHAR(500) NOT NULL,
    "htmlTemplate" TEXT NOT NULL,
    "textTemplate" TEXT,
    "variables" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "email_queue_status_priority_createdAt_idx" ON "email_queue"("status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "email_queue_scheduledFor_idx" ON "email_queue"("scheduledFor");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "email_queue_dayBucket_status_idx" ON "email_queue"("dayBucket", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "email_queue_nextRetryAt_idx" ON "email_queue"("nextRetryAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "email_templates_slug_key" ON "email_templates"("slug");
