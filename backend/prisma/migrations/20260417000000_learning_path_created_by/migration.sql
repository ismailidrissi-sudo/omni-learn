-- Trainer ownership: who created each learning path (nullable for legacy / platform rows)
ALTER TABLE "LearningPath" ADD COLUMN IF NOT EXISTS "createdById" TEXT;

CREATE INDEX IF NOT EXISTS "LearningPath_createdById_idx" ON "LearningPath"("createdById");

DO $$ BEGIN
  ALTER TABLE "LearningPath" ADD CONSTRAINT "LearningPath_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
