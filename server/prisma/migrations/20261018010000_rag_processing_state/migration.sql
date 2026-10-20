ALTER TABLE "documents"
  ADD COLUMN "ragStatus" TEXT NOT NULL DEFAULT 'UPLOADED',
  ADD COLUMN "contentHash" TEXT;
-- Existing documents require a retry to establish extraction coverage and model compatibility.
