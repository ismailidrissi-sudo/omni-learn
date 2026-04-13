-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "joinCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_joinCode_key" ON "Tenant"("joinCode");

-- Backfill: generate 8-char uppercase alphanumeric join codes for existing tenants
UPDATE "Tenant"
SET "joinCode" = upper(substr(md5(random()::text || id), 1, 8))
WHERE "joinCode" IS NULL;
