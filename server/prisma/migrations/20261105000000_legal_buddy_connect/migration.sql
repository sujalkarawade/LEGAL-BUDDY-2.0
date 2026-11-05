-- Legal Buddy Connect: lawyer discovery, verification and consultations.
-- Additive only: no existing table, column or row is altered or dropped.

-- CreateTable
CREATE TABLE "lawyer_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "professionalName" TEXT NOT NULL,
    "professionalTitle" TEXT,
    "bio" TEXT,
    "photoStoredName" TEXT,
    "photoMimeType" TEXT,
    "practiceStartYear" INTEGER,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "education" TEXT,
    "barCouncilState" TEXT NOT NULL,
    "enrollmentNumber" TEXT NOT NULL,
    "enrollmentNumberNormalized" TEXT NOT NULL,
    "enrollmentDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "statusReason" TEXT,
    "source" TEXT NOT NULL DEFAULT 'LEGAL_BUDDY',
    "isSynthetic" BOOLEAN NOT NULL DEFAULT false,
    "offersInPerson" BOOLEAN NOT NULL DEFAULT true,
    "offersOnline" BOOLEAN NOT NULL DEFAULT false,
    "acceptingRequests" BOOLEAN NOT NULL DEFAULT true,
    "feeDisclosed" BOOLEAN NOT NULL DEFAULT false,
    "consultationFeeInr" INTEGER,
    "contactPhone" TEXT,
    "publishPhone" BOOLEAN NOT NULL DEFAULT false,
    "contactEmail" TEXT,
    "publishEmail" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lawyer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lawyer_offices" (
    "id" TEXT NOT NULL,
    "lawyerProfileId" TEXT NOT NULL,
    "officeName" TEXT,
    "addressLine" TEXT NOT NULL,
    "locality" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lawyer_offices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "specializations" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "specializations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lawyer_specializations" (
    "lawyerProfileId" TEXT NOT NULL,
    "specializationId" TEXT NOT NULL,

    CONSTRAINT "lawyer_specializations_pkey" PRIMARY KEY ("lawyerProfileId","specializationId")
);

-- CreateTable
CREATE TABLE "lawyer_availability" (
    "id" TEXT NOT NULL,
    "lawyerProfileId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,

    CONSTRAINT "lawyer_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lawyer_credentials" (
    "id" TEXT NOT NULL,
    "lawyerProfileId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lawyer_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultation_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lawyerProfileId" TEXT NOT NULL,
    "specializationId" TEXT,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "preferredDate" TEXT NOT NULL,
    "preferredTime" TEXT NOT NULL,
    "proposedDate" TEXT,
    "proposedTime" TEXT,
    "scheduledDate" TEXT,
    "scheduledTime" TEXT,
    "rescheduleRequestedBy" TEXT,
    "lawyerMessage" TEXT,
    "userMessage" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "cancelledBy" TEXT,
    "sharedDocumentId" TEXT,
    "documentShareConsentAt" TIMESTAMP(3),
    "documentShareRevokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultation_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lawyer_reports" (
    "id" TEXT NOT NULL,
    "lawyerProfileId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolvedById" TEXT,
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lawyer_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lawyer_profiles_userId_key" ON "lawyer_profiles"("userId");

-- CreateIndex
CREATE INDEX "lawyer_profiles_status_source_idx" ON "lawyer_profiles"("status", "source");

-- CreateIndex
CREATE UNIQUE INDEX "lawyer_profiles_enrollment_key" ON "lawyer_profiles"("barCouncilState", "enrollmentNumberNormalized");

-- CreateIndex
CREATE INDEX "lawyer_offices_lawyerProfileId_idx" ON "lawyer_offices"("lawyerProfileId");

-- CreateIndex
CREATE INDEX "lawyer_offices_latitude_longitude_idx" ON "lawyer_offices"("latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "specializations_slug_key" ON "specializations"("slug");

-- CreateIndex
CREATE INDEX "lawyer_specializations_specializationId_idx" ON "lawyer_specializations"("specializationId");

-- CreateIndex
CREATE INDEX "lawyer_availability_lawyerProfileId_idx" ON "lawyer_availability"("lawyerProfileId");

-- CreateIndex
CREATE INDEX "lawyer_credentials_lawyerProfileId_idx" ON "lawyer_credentials"("lawyerProfileId");

-- CreateIndex
CREATE INDEX "consultation_requests_userId_status_idx" ON "consultation_requests"("userId", "status");

-- CreateIndex
CREATE INDEX "consultation_requests_lawyerProfileId_status_idx" ON "consultation_requests"("lawyerProfileId", "status");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

-- CreateIndex
CREATE INDEX "lawyer_reports_lawyerProfileId_idx" ON "lawyer_reports"("lawyerProfileId");

-- CreateIndex
CREATE INDEX "lawyer_reports_status_idx" ON "lawyer_reports"("status");

-- CreateIndex
CREATE INDEX "admin_audit_logs_entityType_entityId_idx" ON "admin_audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "admin_audit_logs_adminId_idx" ON "admin_audit_logs"("adminId");

-- AddForeignKey
ALTER TABLE "lawyer_profiles" ADD CONSTRAINT "lawyer_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lawyer_offices" ADD CONSTRAINT "lawyer_offices_lawyerProfileId_fkey" FOREIGN KEY ("lawyerProfileId") REFERENCES "lawyer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lawyer_specializations" ADD CONSTRAINT "lawyer_specializations_lawyerProfileId_fkey" FOREIGN KEY ("lawyerProfileId") REFERENCES "lawyer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lawyer_specializations" ADD CONSTRAINT "lawyer_specializations_specializationId_fkey" FOREIGN KEY ("specializationId") REFERENCES "specializations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lawyer_availability" ADD CONSTRAINT "lawyer_availability_lawyerProfileId_fkey" FOREIGN KEY ("lawyerProfileId") REFERENCES "lawyer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lawyer_credentials" ADD CONSTRAINT "lawyer_credentials_lawyerProfileId_fkey" FOREIGN KEY ("lawyerProfileId") REFERENCES "lawyer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_requests" ADD CONSTRAINT "consultation_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_requests" ADD CONSTRAINT "consultation_requests_lawyerProfileId_fkey" FOREIGN KEY ("lawyerProfileId") REFERENCES "lawyer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_requests" ADD CONSTRAINT "consultation_requests_specializationId_fkey" FOREIGN KEY ("specializationId") REFERENCES "specializations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_requests" ADD CONSTRAINT "consultation_requests_sharedDocumentId_fkey" FOREIGN KEY ("sharedDocumentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lawyer_reports" ADD CONSTRAINT "lawyer_reports_lawyerProfileId_fkey" FOREIGN KEY ("lawyerProfileId") REFERENCES "lawyer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lawyer_reports" ADD CONSTRAINT "lawyer_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Data-integrity guards that Prisma cannot express. A (0,0) "null island" office is rejected
-- because it is the usual symptom of a failed geocode rather than a real Indian office.
ALTER TABLE "lawyer_offices" ADD CONSTRAINT "lawyer_offices_coordinates_check"
    CHECK ("latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180 AND NOT ("latitude" = 0 AND "longitude" = 0));
ALTER TABLE "lawyer_availability" ADD CONSTRAINT "lawyer_availability_day_check"
    CHECK ("dayOfWeek" BETWEEN 0 AND 6 AND "startTime" < "endTime");

-- Reference data (practice-area names, not people). Safe to re-run thanks to ON CONFLICT.
INSERT INTO "specializations" ("id", "slug", "name", "sortOrder", "updatedAt") VALUES
    (gen_random_uuid()::text, 'corporate-law', 'Corporate Law', 10, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'contract-law', 'Contract Law', 20, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'civil-law', 'Civil Law', 30, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'criminal-law', 'Criminal Law', 40, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'family-law', 'Family Law', 50, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'property-real-estate-law', 'Property and Real Estate Law', 60, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'employment-labour-law', 'Employment and Labour Law', 70, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'intellectual-property-law', 'Intellectual Property Law', 80, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'consumer-law', 'Consumer Law', 90, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'taxation-law', 'Taxation Law', 100, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'cyber-law', 'Cyber Law', 110, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'arbitration-dispute-resolution', 'Arbitration and Dispute Resolution', 120, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'other', 'Other Specializations', 999, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
