-- AlterTable
ALTER TABLE "trainer_profiles" ADD COLUMN IF NOT EXISTS "expertiseDomains" JSONB DEFAULT '[]';
ALTER TABLE "trainer_profiles" ADD COLUMN IF NOT EXISTS "availability" JSONB DEFAULT '{}';
