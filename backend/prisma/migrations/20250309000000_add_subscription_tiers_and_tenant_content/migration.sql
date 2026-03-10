-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('EXPLORER', 'SPECIALIST', 'VISIONARY', 'NEXUS');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'ANNUAL');

-- AlterTable: User - add subscription fields
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "planId" "SubscriptionPlan" NOT NULL DEFAULT 'EXPLORER';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "billingCycle" "BillingCycle";
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sectorFocus" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT;

-- AlterTable: ContentItem - add access control fields
ALTER TABLE "ContentItem" ADD COLUMN IF NOT EXISTS "accessLevel" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ContentItem" ADD COLUMN IF NOT EXISTS "sectorTag" TEXT;
ALTER TABLE "ContentItem" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "ContentItem" ADD COLUMN IF NOT EXISTS "isFoundational" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ContentItem_tenantId_idx" ON "ContentItem"("tenantId");
CREATE INDEX IF NOT EXISTS "ContentItem_sectorTag_idx" ON "ContentItem"("sectorTag");
CREATE INDEX IF NOT EXISTS "ContentItem_isFoundational_idx" ON "ContentItem"("isFoundational");

-- AddForeignKey (ContentItem.tenantId -> Tenant.id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ContentItem_tenantId_fkey'
  ) THEN
    ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_tenantId_fkey" 
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
