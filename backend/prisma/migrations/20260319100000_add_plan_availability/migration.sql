-- Add plan availability and enterprise access fields to ContentItem
ALTER TABLE "ContentItem"
ADD COLUMN "availablePlans" JSONB NOT NULL DEFAULT '["EXPLORER","SPECIALIST","VISIONARY","NEXUS"]',
ADD COLUMN "availableInEnterprise" BOOLEAN NOT NULL DEFAULT false;

-- Add plan availability and enterprise access fields to LearningPath
ALTER TABLE "LearningPath"
ADD COLUMN "availablePlans" JSONB NOT NULL DEFAULT '["EXPLORER","SPECIALIST","VISIONARY","NEXUS"]',
ADD COLUMN "availableInEnterprise" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: content marked as isFoundational should include EXPLORER in availablePlans
-- (all existing content already defaults to all plans, so no backfill needed for availablePlans)

-- Backfill: content with tenant assignments should be marked as enterprise-available
UPDATE "ContentItem"
SET "availableInEnterprise" = true
WHERE id IN (
  SELECT DISTINCT "contentId" FROM "ContentTenantAssignment"
);
