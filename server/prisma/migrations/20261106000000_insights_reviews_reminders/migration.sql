-- Lawyer clause reviews, obligation reminders and separate consent for sharing clause findings.
-- Additive only.

-- AlterTable
ALTER TABLE "consultation_requests" ADD COLUMN "analysisShareConsentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "clause_review_comments" (
    "id" TEXT NOT NULL,
    "consultationRequestId" TEXT NOT NULL,
    "clauseFindingId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "suggestedText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clause_review_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obligation_reminders" (
    "id" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "remindOn" TEXT NOT NULL,
    "note" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "obligation_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clause_review_comments_consultationRequestId_idx" ON "clause_review_comments"("consultationRequestId");

-- CreateIndex
CREATE INDEX "clause_review_comments_clauseFindingId_idx" ON "clause_review_comments"("clauseFindingId");

-- CreateIndex
CREATE UNIQUE INDEX "obligation_reminders_obligationId_userId_key" ON "obligation_reminders"("obligationId", "userId");

-- CreateIndex
CREATE INDEX "obligation_reminders_remindOn_notifiedAt_idx" ON "obligation_reminders"("remindOn", "notifiedAt");

-- AddForeignKey
ALTER TABLE "clause_review_comments" ADD CONSTRAINT "clause_review_comments_consultationRequestId_fkey" FOREIGN KEY ("consultationRequestId") REFERENCES "consultation_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clause_review_comments" ADD CONSTRAINT "clause_review_comments_clauseFindingId_fkey" FOREIGN KEY ("clauseFindingId") REFERENCES "clause_findings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clause_review_comments" ADD CONSTRAINT "clause_review_comments_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligation_reminders" ADD CONSTRAINT "obligation_reminders_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "extracted_obligations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligation_reminders" ADD CONSTRAINT "obligation_reminders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "obligation_reminders" ADD CONSTRAINT "obligation_reminders_remindOn_check" CHECK ("remindOn" ~ '^\d{4}-\d{2}-\d{2}$');
ALTER TABLE "clause_review_comments" ADD CONSTRAINT "clause_review_comments_values_check"
    CHECK ("authorRole" IN ('LAWYER', 'USER') AND "verdict" IN ('ACCEPTABLE', 'NEEDS_CHANGE', 'COMMENT'));
