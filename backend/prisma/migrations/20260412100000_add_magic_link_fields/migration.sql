-- AlterTable: add magic link invite fields to User
ALTER TABLE "User" ADD COLUMN "magicLinkTokenHash" VARCHAR(128);
ALTER TABLE "User" ADD COLUMN "magicLinkExpiresAt" TIMESTAMP(3);
