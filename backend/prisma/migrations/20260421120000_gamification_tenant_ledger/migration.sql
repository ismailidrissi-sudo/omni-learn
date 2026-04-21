-- Gamification: tenant-scoped UserPoints, PointsLedger, streak timezone

-- AlterTable
ALTER TABLE "UserPoints" ADD COLUMN "tenantId" TEXT;

UPDATE "UserPoints" up
SET "tenantId" = u."tenantId"
FROM "User" u
WHERE up."userId" = u."id";

DELETE FROM "UserPoints" WHERE "tenantId" IS NULL;

ALTER TABLE "UserPoints" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "UserPoints" ADD COLUMN "updatedAt" TIMESTAMP(3);
UPDATE "UserPoints" SET "updatedAt" = COALESCE("lastUpdated", CURRENT_TIMESTAMP);
ALTER TABLE "UserPoints" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "UserPoints" DROP COLUMN "lastUpdated";

-- CreateTable
CREATE TABLE "PointsLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointsLedger_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "UserStreak" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC';

-- CreateIndex
CREATE UNIQUE INDEX "PointsLedger_idempotencyKey_key" ON "PointsLedger"("idempotencyKey");

CREATE INDEX "PointsLedger_userId_createdAt_idx" ON "PointsLedger"("userId", "createdAt" DESC);

CREATE INDEX "PointsLedger_tenantId_createdAt_idx" ON "PointsLedger"("tenantId", "createdAt" DESC);

CREATE INDEX "UserPoints_tenantId_points_idx" ON "UserPoints"("tenantId", "points" DESC);

-- AddForeignKey
ALTER TABLE "UserPoints" ADD CONSTRAINT "UserPoints_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PointsLedger" ADD CONSTRAINT "PointsLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PointsLedger" ADD CONSTRAINT "PointsLedger_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
