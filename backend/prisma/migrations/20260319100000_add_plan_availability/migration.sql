-- Add plan availability and enterprise access fields to ContentItem
ALTER TABLE "ContentItem"
ADD COLUMN IF NOT EXISTS "availablePlans" JSONB NOT NULL DEFAULT '["EXPLORER","SPECIALIST","VISIONARY","NEXUS"]',
ADD COLUMN IF NOT EXISTS "availableInEnterprise" BOOLEAN NOT NULL DEFAULT false;

-- Add plan availability and enterprise access fields to LearningPath
ALTER TABLE "LearningPath"
ADD COLUMN IF NOT EXISTS "availablePlans" JSONB NOT NULL DEFAULT '["EXPLORER","SPECIALIST","VISIONARY","NEXUS"]',
ADD COLUMN IF NOT EXISTS "availableInEnterprise" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: content with tenant assignments should be marked as enterprise-available
UPDATE "ContentItem"
SET "availableInEnterprise" = true
WHERE id IN (
  SELECT DISTINCT "contentId" FROM "ContentTenantAssignment"
);
