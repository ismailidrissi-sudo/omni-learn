-- Trainer ownership: who created each content item (nullable for legacy / platform rows)
ALTER TABLE "ContentItem" ADD COLUMN "createdById" TEXT;

CREATE INDEX "ContentItem_createdById_idx" ON "ContentItem"("createdById");

ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
