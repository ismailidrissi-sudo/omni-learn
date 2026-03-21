-- Trainer ownership: who created each content item (nullable for legacy / platform rows)
ALTER TABLE "ContentItem" ADD COLUMN IF NOT EXISTS "createdById" TEXT;

CREATE INDEX IF NOT EXISTS "ContentItem_createdById_idx" ON "ContentItem"("createdById");

DO $$ BEGIN
  ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
