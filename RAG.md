# Legal Buddy RAG implementation and operations

## Existing architecture and inspection

The original application already accepted PDF files through Multer, stored them on disk, used `pdf-parse` for selectable page text, and used a persistent local PaddleOCR Python worker for scans. OCR results were cached by PDF hash and OCR configuration. PostgreSQL/Prisma stored documents, page chunks, analysis records and per-user conversations. React had upload progress, OCR editing, chat and a citation inspector. The AI adapter supported Gemini, Groq/OpenRouter and a rule engine; summaries, clauses, completeness checks and obligations shared extracted text.

At inspection, the working directory also contained an unfinished RAG patch: Gemini embeddings serialized in chunk rows, lexical/semantic ranking, overlapping chunks, a small test file and citation metadata. Those changes were retained and hardened. There is one ingestion and retrieval path, and no additional database or OCR engine.

Documents and users have UUIDs. `Document.userId` is the owner. Each chunk carries `documentId`, `chunkIndex`, database-generated `id`, `pageNumber`, `extractionMethod`, optional `clauseHeading`, `embedding` and `embeddingModel`. Page references are one-based physical PDF pages, not printed page labels. Chunks do not cross pages.

## Retrieval flow

1. Upload a PDF. The server checks authentication, file type, header and PDF structure. PDF is the existing supported input format; DOCX remains an output format.
2. Extract selectable page text directly; send scanned pages to the existing PaddleOCR worker. Preserve text, page, method and confidence. Empty/failed pages require retry or explicit manual verification, including confirmation of blank pages.
3. Split source text into bounded, overlapping chunks, preferring paragraph/clause boundaries, then sentence and word boundaries. Preserve literal source substrings, numbers and Devanagari marks.
4. Embed usable chunks when Gemini is configured. Reuse unchanged text/model vectors. Checkpoint successful chunk embeddings so a later failure does not require recomputing completed work.
5. For a question, load chunks using both the selected document ID and authenticated owner in the database predicate. Only these rows enter ranking or model context.
6. Rank compatible vectors by cosine similarity and exact terms by weighted lexical matching; combine ranks using reciprocal rank fusion. Query embedding failures use an explicit keyword fallback. No uncalibrated semantic cutoff is used. Candidates are not automatically confirmed citations.
7. Ask the answer model to select supporting passages or abstain. Gemini is preferred for document chat when configured; the existing Groq/OpenRouter client is retained as a fallback when Gemini is absent. Other analysis features keep their provider selection.
8. Validate JSON output, source chunk identity and exact contiguous excerpts. Page numbers and filenames come from server metadata. Reject invented references, unsupported quotations, missing sources and model-written page labels. Display only verified references, separately from the generated explanation, with OCR warnings and authenticated PDF/page links.

Citation validation proves that an excerpt exists in extracted text. It does **not** prove that every generated interpretation follows from that excerpt. Human review and representative evaluation remain necessary.

## Models and storage

- Embedding model: `gemini-embedding-001`, 768 dimensions, `RETRIEVAL_DOCUMENT` and `RETRIEVAL_QUERY` tasks.
- Index signature: `<model>:768:retrieval-v1`. Legacy vectors with only a model name are rebuilt. Malformed, zero, dimension-mismatched and differently versioned vectors are excluded.
- Default Gemini generation model: `gemini-2.5-flash`, configurable through `GEMINI_CHAT_MODEL`.
- Vector storage: existing PostgreSQL `document_chunks.embedding` text column containing JSON float arrays, accessed through Prisma. Similarity runs in Node after authorization filtering. There is no pgvector extension or separate vector database.
- This performs an exact scan of one authorized document, with memory and CPU proportional to its chunks and vector dimensions. It is suitable for the current document-scoped application. Measure larger collections before moving similarity into pgvector.
- Chunk size defaults to 1,500 characters; overlap 180; retrieval limit 5. Size is validated in the range 300–3,000 and overlap at most half the size.
- Embedding requests have 30-second timeouts and up to three attempts on transient failures. Authentication/invalid-request errors fail immediately. No partial index is marked ready.
- After a model/configuration change, use OCR Preview → Retry processing. The current model must match all vectors before semantic chat is accepted. Embedding migrations do not silently mix models.

Google documents multilingual embeddings and retrieval task types in its [embedding guide](https://ai.google.dev/gemini-api/docs/embeddings) and structured generation in the [Gemini 2.5 Flash model documentation](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash). Those capabilities do not establish Marathi legal-document accuracy in this application.

## Processing, cache and retries

The legacy `status` remains compatible with existing screens: `UPLOADED`, `PROCESSING`, `COMPLETED`, `FAILED`. `ragStatus` records `UPLOADED`, `EXTRACTING`, `INDEXING`, `READY`, `KEYWORD_READY`, `REVIEW_REQUIRED`, or `FAILED`.

`READY` requires complete usable/verified page coverage and compatible embeddings. `KEYWORD_READY` means embeddings are disabled (no Gemini key, or explicit heuristic mode). Empty or failed pages prevent readiness; nonempty low-confidence OCR remains flagged and its citations carry warnings. No embeddings are made from failed-page placeholders or empty text.

Extraction metadata and document hash are saved before indexing. The retry endpoint reuses successful pages when the PDF hash is unchanged. A supplied `pageNumbers` array forces only those pages through OCR. Manual verification merges selected pages into the existing page set and uses the same processor and analyses. Reprocessing invalidates previous confirmed chat citations before extraction, including failed attempts. Chat history hides confirmed citations while the document is not ready. A document revision lock prevents an answer from saving sources across a concurrent document change.

Completed analyses are reused when the exact extracted text has not changed, preserving clause/obligation decisions and completeness review flags. The internal `analysisTextHash` in OCR metadata records which text produced those analyses. Changed-text analyses and their hash are committed together in a database transaction; indexing failures cannot falsely mark old analyses as current. The OCR cache reuses readable pages individually and retries empty/failed pages.

Uploads, retries and OCR verification return HTTP 202 plus a job ID. Poll `/api/documents/jobs/:jobId` for progress. The UI waits for terminal completion and exposes selected-page retry. Persistent document states/errors survive restarts; transient job progress is in memory. On startup, interrupted jobs become failed and can be retried from saved pages. **Run one backend worker**: this is not a distributed queue, and job progress is not durable across restarts.

## Setup and migrations

Requires Node 20+, PostgreSQL, and Python with the existing [OCR requirements](server/ocr/README.md).

From the repository root:

```powershell
npm install
npm install --prefix server
npm install --prefix client
Copy-Item server/.env.example server/.env  # Only if .env does not already exist
```

Configure `DATABASE_URL`, a random `JWT_SECRET`, `CLIENT_URL` and `GEMINI_API_KEY` in **server/.env**. Set `AI_PROVIDER=gemini` if other document analyses should prefer Gemini too. `AI_PROVIDER=heuristic` disables external generation and embeddings even if keys remain configured; chat abstains while other analyses use local rules. Production requires a unique JWT secret of at least 32 characters and rejects known development placeholders. With no development secret, a random process-local secret is used, invalidating sessions on restart. No frontend secrets are needed. CORS allows the configured client origin.

For a **new empty database**:

```powershell
cd server
npm run prisma:generate
npm run prisma:migrate
npm run seed  # Optional development users and templates
cd ..
npm run dev
```

For an **existing database created with db push**, take a database backup and inspect its columns first. If it matches the original application schema, mark the baseline as applied, then deploy:

```powershell
cd server
npx prisma migrate resolve --applied 20261017000000_baseline
npm run prisma:migrate
npm run prisma:generate
```

If the four RAG columns (`extractionMethod`, `clauseHeading`, `embedding`, `embeddingModel`) already exist from the earlier patch, also mark `20261018000000_add_rag_chunk_metadata` as applied **before** deployment. Do not mark an absent migration as applied. This workspace had those columns already; the baseline and metadata migration were recorded, and `20261018010000_rag_processing_state` was applied successfully without resetting data.

Existing documents initially have `ragStatus=UPLOADED`. Retry processing to establish page coverage and build the current index before using chat.

Development: `npm run dev` starts frontend at http://localhost:5173 and backend at http://localhost:5000. Production: `npm run build`, then `npm run start --prefix server`; serve the client build behind an authenticated API reverse proxy. Run the backend from its server directory so .env, upload and OCR paths resolve consistently.

## Verification commands

```powershell
npm run build
npm run test:rag --prefix server
npm run test:rag:integration --prefix server
npm run test:api --prefix server  # Full existing API suite, controlled provider, no external requests
npm run eval:rag --prefix server
npm run eval:rag --prefix server -- --live  # Optional: calls the configured answer provider
npm run test:ocr --prefix server
cd server
npx tsx scripts/evaluate-live-rag.ts
npx tsx scripts/test-e2e.ts
```

Unit tests mock embedding HTTP; they never use a live embedding key. Integration tests use the configured PostgreSQL database, create isolated test owners/documents, disable external AI, and remove their own records/files afterward. Run against a development database. The live evaluator uses repository synthetic PDFs and the configured providers; it records answers, passages, page checks and timings for manual review. The older full application E2E script uses seeded development users and creates sample documents/drafts.

Evaluation fixtures cover explicit payment, long-document retrieval, clause identifiers, dates/amounts, absent answers, conflicting terms, Marathi text, low-quality OCR and cross-user access. Synthetic Marathi text fixtures test token handling only; the separate OCR suite executes the image-only PDF.

See the latest [stabilization audit](server/evaluations/AUDIT.md), earlier [recorded results](server/evaluations/RESULTS.md), [retrieval measurements](server/evaluations/last-retrieval-results.json), and historical [live sample outputs](server/evaluations/last-live-results.json). No production accuracy score is claimed.

## Known limits

- This workspace has no Gemini key. Live Gemini embedding and Gemini answer generation remain unverified; the API contract, retry handling, vector compatibility and semantic ranking are tested with controlled vectors.
- The configured OpenRouter fallback returned HTTP 402 for insufficient credit during the final full application E2E (21/22 checks passed). Chat now explains provider credit/authentication/rate-limit failures without displaying unsupported citations. Restoring provider availability and rerunning live checks is still required.
- The mixed-language scan contains two text pages and a blank third page. OCR confidence was low, and a live generated Marathi answer was withheld because it could not be verified. Production chat blocks this document until the blank/failed page is reviewed. Marathi-English reliability is not established.
- The synthetic fixtures and sample PDFs are not a representative production legal corpus. Native-speaker review of real scans, cross-language semantic queries, ambiguous terms and numeric OCR errors is still required.
- Ranking scores are not probabilities or OCR confidence. The UI does not present them as match percentages. Semantic candidates may be irrelevant; answer generation must abstain when evidence does not support the question.
- Chat questions are evaluated independently; previous assistant messages are not fed back as contract evidence. Explicitly name a clause or subject in follow-up questions.
- The original summaries, clause/completeness analyses and obligation extraction still use the shared full extracted text and their existing rules/provider behavior. The new strict source validator applies to chat, not to all legacy analysis outputs.
