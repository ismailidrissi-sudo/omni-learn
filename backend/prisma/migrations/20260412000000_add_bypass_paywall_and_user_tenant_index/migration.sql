-- AlterTable: add bypassesPublicPaywall to ContentTenantAssignment
ALTER TABLE "ContentTenantAssignment" ADD COLUMN "bypassesPublicPaywall" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex: high-performance tenant-scoped user lookups
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");
