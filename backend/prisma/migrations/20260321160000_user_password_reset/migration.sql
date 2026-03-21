-- Password reset tokens (hashed at rest)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordResetTokenHash" VARCHAR(128);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordResetExpiresAt" TIMESTAMP(3);
