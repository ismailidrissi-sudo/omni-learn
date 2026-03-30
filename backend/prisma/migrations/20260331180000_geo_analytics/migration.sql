-- AlterTable
ALTER TABLE "user_sessions" ADD COLUMN "continent" VARCHAR(30);

-- CreateIndex
CREATE INDEX "user_sessions_countryCode_idx" ON "user_sessions"("countryCode");

-- CreateIndex
CREATE INDEX "user_sessions_continent_startedAt_idx" ON "user_sessions"("continent", "startedAt");

-- CreateTable
CREATE TABLE "content_access_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "deviceType" VARCHAR(20) NOT NULL DEFAULT 'web',
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "screenshotAttempt" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "country" VARCHAR(100),
    "countryCode" VARCHAR(3),
    "city" VARCHAR(100),
    "region" VARCHAR(100),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "continent" VARCHAR(30),

    CONSTRAINT "content_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geo_analytics_rollups" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "period" VARCHAR(10) NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "country" VARCHAR(100) NOT NULL,
    "countryCode" VARCHAR(3) NOT NULL,
    "city" VARCHAR(100) NOT NULL DEFAULT '',
    "region" VARCHAR(100),
    "activeUsers" INTEGER NOT NULL DEFAULT 0,
    "newRegistrations" INTEGER NOT NULL DEFAULT 0,
    "contentViews" INTEGER NOT NULL DEFAULT 0,
    "courseCompletions" INTEGER NOT NULL DEFAULT 0,
    "pathCompletions" INTEGER NOT NULL DEFAULT 0,
    "certsIssued" INTEGER NOT NULL DEFAULT 0,
    "totalTimeSpentMin" INTEGER NOT NULL DEFAULT 0,
    "quizAttempts" INTEGER NOT NULL DEFAULT 0,
    "avgQuizScore" DOUBLE PRECISION,
    "webSessions" INTEGER NOT NULL DEFAULT 0,
    "iosSessions" INTEGER NOT NULL DEFAULT 0,
    "androidSessions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geo_analytics_rollups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_access_logs_userId_createdAt_idx" ON "content_access_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "content_access_logs_country_createdAt_idx" ON "content_access_logs"("country", "createdAt");

-- CreateIndex
CREATE INDEX "content_access_logs_countryCode_idx" ON "content_access_logs"("countryCode");

-- CreateIndex
CREATE INDEX "content_access_logs_continent_createdAt_idx" ON "content_access_logs"("continent", "createdAt");

-- CreateIndex
CREATE INDEX "content_access_logs_contentId_idx" ON "content_access_logs"("contentId");

-- CreateIndex
CREATE INDEX "content_access_logs_createdAt_idx" ON "content_access_logs"("createdAt");

-- CreateIndex
CREATE INDEX "geo_analytics_rollups_tenantId_period_periodStart_idx" ON "geo_analytics_rollups"("tenantId", "period", "periodStart");

-- CreateIndex
CREATE INDEX "geo_analytics_rollups_countryCode_period_idx" ON "geo_analytics_rollups"("countryCode", "period");

-- CreateIndex
CREATE UNIQUE INDEX "geo_analytics_rollups_tenantId_period_periodStart_country_city_key" ON "geo_analytics_rollups"("tenantId", "period", "periodStart", "country", "city");

-- AddForeignKey
ALTER TABLE "content_access_logs" ADD CONSTRAINT "content_access_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_access_logs" ADD CONSTRAINT "content_access_logs_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geo_analytics_rollups" ADD CONSTRAINT "geo_analytics_rollups_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
