-- CreateEnum
CREATE TYPE "ApprovalRequestType" AS ENUM ('PLAN_UPGRADE', 'COMPANY_JOIN', 'PRIVATE_LABEL');

-- CreateEnum
CREATE TYPE "ApprovalRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "UserAccountStatus" AS ENUM ('ACTIVE', 'PENDING_PLAN', 'PENDING_COMPANY', 'SUSPENDED');

-- AlterTable User
ALTER TABLE "User" ADD COLUMN "countryCode" VARCHAR(3),
ADD COLUMN "timezone" VARCHAR(50),
ADD COLUMN "accountStatus" "UserAccountStatus" NOT NULL DEFAULT 'ACTIVE';

-- Backfill: align with existing org join pending state
UPDATE "User" SET "accountStatus" = 'PENDING_COMPANY' WHERE "orgApprovalStatus" = 'PENDING';

-- AlterTable Tenant
ALTER TABLE "Tenant" ADD COLUMN "tenantKind" VARCHAR(30) NOT NULL DEFAULT 'INDIVIDUAL',
ADD COLUMN "privateLabelConfig" JSONB DEFAULT '{}',
ADD COLUMN "tenantApprovalStatus" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "ApprovalRequestType" NOT NULL,
    "status" "ApprovalRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requesterId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "approval_requests_tenantId_status_idx" ON "approval_requests"("tenantId", "status");

-- CreateIndex
CREATE INDEX "approval_requests_type_status_idx" ON "approval_requests"("type", "status");

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
