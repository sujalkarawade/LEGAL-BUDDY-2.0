ALTER TABLE "document_chunks"
  ADD COLUMN "extractionMethod" TEXT NOT NULL DEFAULT 'selectable',
  ADD COLUMN "clauseHeading" TEXT,
  ADD COLUMN "embedding" TEXT,
  ADD COLUMN "embeddingModel" TEXT;
