-- CreateTable: CourseEnrollment
CREATE TABLE "CourseEnrollment" (
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
CREATE TABLE "CourseSectionItemProgress" (
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
ALTER TABLE "IssuedCertificate" ADD COLUMN "courseEnrollmentId" TEXT;

-- CreateIndex: CourseEnrollment
CREATE UNIQUE INDEX "CourseEnrollment_userId_courseId_key" ON "CourseEnrollment"("userId", "courseId");
CREATE INDEX "CourseEnrollment_userId_idx" ON "CourseEnrollment"("userId");
CREATE INDEX "CourseEnrollment_courseId_idx" ON "CourseEnrollment"("courseId");

-- CreateIndex: CourseSectionItemProgress
CREATE UNIQUE INDEX "CourseSectionItemProgress_enrollmentId_sectionItemId_key" ON "CourseSectionItemProgress"("enrollmentId", "sectionItemId");
CREATE INDEX "CourseSectionItemProgress_enrollmentId_idx" ON "CourseSectionItemProgress"("enrollmentId");
CREATE INDEX "CourseSectionItemProgress_sectionItemId_idx" ON "CourseSectionItemProgress"("sectionItemId");

-- CreateIndex: IssuedCertificate courseEnrollmentId
CREATE INDEX "IssuedCertificate_courseEnrollmentId_idx" ON "IssuedCertificate"("courseEnrollmentId");

-- AddForeignKey: CourseEnrollment -> ContentItem
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: CourseSectionItemProgress -> CourseEnrollment
ALTER TABLE "CourseSectionItemProgress" ADD CONSTRAINT "CourseSectionItemProgress_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "CourseEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: CourseSectionItemProgress -> CourseSectionItem
ALTER TABLE "CourseSectionItemProgress" ADD CONSTRAINT "CourseSectionItemProgress_sectionItemId_fkey" FOREIGN KEY ("sectionItemId") REFERENCES "CourseSectionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: IssuedCertificate -> CourseEnrollment
ALTER TABLE "IssuedCertificate" ADD CONSTRAINT "IssuedCertificate_courseEnrollmentId_fkey" FOREIGN KEY ("courseEnrollmentId") REFERENCES "CourseEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
