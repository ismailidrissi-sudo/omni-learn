-- CreateEnum: EnrollmentStatus
DO $$ BEGIN
  CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'DROPPED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum: StepProgressStatus
DO $$ BEGIN
  CREATE TYPE "StepProgressStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable: CourseEnrollment
CREATE TABLE IF NOT EXISTS "CourseEnrollment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "progressPct" INTEGER NOT NULL DEFAULT 0,
    "deadline" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CourseSectionItemProgress
CREATE TABLE IF NOT EXISTS "CourseSectionItemProgress" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "sectionItemId" TEXT NOT NULL,
    "status" "StepProgressStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "timeSpent" INTEGER,
    "score" INTEGER,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseSectionItemProgress_pkey" PRIMARY KEY ("id")
);

-- AlterTable: IssuedCertificate — make enrollmentId nullable, add courseEnrollmentId
ALTER TABLE "IssuedCertificate" ALTER COLUMN "enrollmentId" DROP NOT NULL;
ALTER TABLE "IssuedCertificate" ADD COLUMN IF NOT EXISTS "courseEnrollmentId" TEXT;

-- CreateIndex: CourseEnrollment
CREATE UNIQUE INDEX IF NOT EXISTS "CourseEnrollment_userId_courseId_key" ON "CourseEnrollment"("userId", "courseId");
CREATE INDEX IF NOT EXISTS "CourseEnrollment_userId_idx" ON "CourseEnrollment"("userId");
CREATE INDEX IF NOT EXISTS "CourseEnrollment_courseId_idx" ON "CourseEnrollment"("courseId");

-- CreateIndex: CourseSectionItemProgress
CREATE UNIQUE INDEX IF NOT EXISTS "CourseSectionItemProgress_enrollmentId_sectionItemId_key" ON "CourseSectionItemProgress"("enrollmentId", "sectionItemId");
CREATE INDEX IF NOT EXISTS "CourseSectionItemProgress_enrollmentId_idx" ON "CourseSectionItemProgress"("enrollmentId");
CREATE INDEX IF NOT EXISTS "CourseSectionItemProgress_sectionItemId_idx" ON "CourseSectionItemProgress"("sectionItemId");

-- CreateIndex: IssuedCertificate courseEnrollmentId
CREATE INDEX IF NOT EXISTS "IssuedCertificate_courseEnrollmentId_idx" ON "IssuedCertificate"("courseEnrollmentId");

-- AddForeignKey: CourseEnrollment -> ContentItem
DO $$ BEGIN
  ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey: CourseSectionItemProgress -> CourseEnrollment
DO $$ BEGIN
  ALTER TABLE "CourseSectionItemProgress" ADD CONSTRAINT "CourseSectionItemProgress_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "CourseEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey: CourseSectionItemProgress -> CourseSectionItem
DO $$ BEGIN
  ALTER TABLE "CourseSectionItemProgress" ADD CONSTRAINT "CourseSectionItemProgress_sectionItemId_fkey" FOREIGN KEY ("sectionItemId") REFERENCES "CourseSectionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey: IssuedCertificate -> CourseEnrollment
DO $$ BEGIN
  ALTER TABLE "IssuedCertificate" ADD CONSTRAINT "IssuedCertificate_courseEnrollmentId_fkey" FOREIGN KEY ("courseEnrollmentId") REFERENCES "CourseEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
