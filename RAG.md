# Legal Buddy RAG implementation and operations

## Existing architecture and inspection

The application accepts PDFs through Multer, extracts selectable page text with pdf-parse, and uses its persistent PaddleOCR Python worker for scans. OCR results are cached by PDF hash and configuration. PostgreSQL/Prisma stores documents, page chunks, analysis records and per-user conversations. The existing upload progress, OCR editing, chat, citation inspector and Groq/OpenRouter answer integration are preserved.

At the start of the hybrid search upgrade, retrieval was keyword-only and the former vector fields remained unused. The smallest compatible change was to reuse those fields for local, versioned embeddings and restore cosine ranking alongside BM25 in the existing retrieval service. There is one ingestion/retrieval path, no extra database, and no paid retrieval API.

Documents and users have UUIDs. Document.userId is the owner. Chunks preserve document ID, chunk ID/index, physical PDF page, heading, extraction method and embedding version. Retrieval attaches the authenticated owner, source filename and page OCR review flags from server records. Chunks never cross page boundaries.

## Retrieval flow

1. Upload a PDF. The server checks authentication, file type, header and PDF structure. PDF is the existing supported input format; DOCX remains an output format.
2. Extract selectable page text directly; send scanned pages to the existing PaddleOCR worker. Preserve text, page, method and confidence. Empty/failed pages require retry or explicit manual verification, including confirmation of blank pages.
3. Split source text into bounded, overlapping chunks, preferring paragraph/clause boundaries, then sentence and word boundaries. Preserve literal source substrings, numbers and Devanagari marks.
4. Store chunks and local CPU embeddings in the existing PostgreSQL columns. Reuse unchanged text and compatible vectors; checkpoint successful chunks for retries. Empty/failed text is not embedded.
5. For a question, load chunks using both the selected document ID and authenticated owner in the database predicate. Only these rows enter ranking or model context.
6. Rank authorized chunks with BM25 (Unicode terms, headings, clause numbers, dates and amounts) and cosine similarity. Merge the two candidate lists by chunk ID with Reciprocal Rank Fusion: sum of 1 / (RRF_K + one-based rank). Old/incompatible vectors are excluded. Query embedding failure uses a labeled keyword fallback.
7. Optionally rerank the candidate pool using local features: query coverage, heading matches, adjacent query terms, quoted names/phrases and exact clause identifiers. This is a bounded feature reranker, not a trained cross-encoder. It defaults off because the measured fixture showed no additional benefit over hybrid retrieval. Send the selected passages to the existing answer provider; if generation is unavailable or evidence cannot be verified, abstain.
8. Validate JSON output, source chunk identity and exact contiguous excerpts. Page numbers and filenames come from server metadata. Reject invented references, unsupported quotations, missing sources and model-written page labels. Display only verified references, separately from the generated explanation, with OCR warnings and authenticated PDF/page links.

Citation validation proves that an excerpt exists in extracted text. It does **not** prove that every generated interpretation follows from that excerpt. Human review and representative evaluation remain necessary.

## Embeddings, storage and retrieval settings

- Local embedding model evaluated: sentence-transformers/all-MiniLM-L6-v2, 384 dimensions, CPU. The setup script pins the public model revision. This model is English-focused; Marathi semantic retrieval is not established.
- The private Python worker loads only local files with offline mode and remote code disabled. It never downloads at runtime or transmits document text. Long chunks are encoded in token windows and normalized mean-pooled to avoid silent truncation.
- The stored embedding signature includes a hash of weights/tokenizer/configuration, library version, dimensions and pooling algorithm. Changing weights or runtime requires a server restart and document reprocessing. Incompatible rows use keyword retrieval until rebuilt; partial vector coverage is reported explicitly.
- Existing PostgreSQL text columns store JSON vectors. Node computes exact cosine similarity after authorization filtering. No schema migration, pgvector extension or additional database is required. This remains an exact scan and should be reevaluated for large collections.
- searchAuthorized validates the user and explicit document selection (up to 20 IDs), rejects the entire selection if any document is unauthorized, and scopes the chunk database query by owner and document IDs before ranking. Existing chat routes continue to select a single document. Collection service tests cover multiple permitted documents and cross-user rejection.
- Chat cites server-side chunk text and page metadata. The shared validator rejects fabricated excerpts, foreign chunk IDs and free-form generated page labels. No top candidate is automatically promoted into a confirmed citation.
- Chunks default to 1,500 characters with 180-character overlap; retrieval limit defaults to 5. These settings remain configurable.
- Retrieval settings: RAG_SEARCH_MODE=hybrid, RAG_RETRIEVAL_LIMIT=5, RAG_CANDIDATE_LIMIT=24, RAG_RRF_K=60, RAG_RERANK_ENABLED=false, RAG_RERANK_TIMEOUT_MS=40, RAG_SEARCH_TIMEOUT_MS=5000, RAG_MAX_CHUNKS=20000. Invalid environment values fail startup. Semantic-only and keyword-only modes are available for evaluation.
- Local model startup timeout is 120 seconds; embedding requests have a 30-second worker timeout. Interactive searches have a 5-second wait budget and degrade to keywords if query embeddings fail. Database waits fail with a retryable error; pending SQL reads may finish in the background. Rerank timeout preserves the complete RRF order.
- Optional RAG_LOG_METRICS emits counts, modes and timings only. Logs exclude questions, excerpts, credentials and raw provider errors. Ranking/reranking scores are not calibrated confidence values. No semantic relevance threshold is claimed; generation must still select evidence or abstain.

Install the optional local runtime and public model from the server directory:

```powershell
python -m pip install -r retrieval/requirements.txt
python scripts/download-embedding-model.py
```

The model cache is ignored by Git. Embeddings default on when the default local model directory exists. Use RAG_EMBEDDING_ENABLED=false for keyword-only operation; RAG_EMBEDDING_MODEL_PATH and RAG_EMBEDDING_PYTHON select another approved local directory/interpreter. No retrieval API key is used. Retry existing documents from OCR Preview to build compatible local vectors. The application database credentials must be configured separately; the verification run used a disposable local PostgreSQL cluster because the normal URL contained placeholders.

See the official [MiniLM model card](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2) and [Sentence Transformers offline loading options](https://sbert.net/docs/package_reference/sentence_transformer/model.html). Model capabilities do not establish legal-answer or Marathi OCR accuracy.

## Processing, cache and retries

The legacy `status` remains compatible with existing screens: `UPLOADED`, `PROCESSING`, `COMPLETED`, `FAILED`. `ragStatus` records `UPLOADED`, `EXTRACTING`, `INDEXING`, `READY`, `KEYWORD_READY`, `REVIEW_REQUIRED`, or `FAILED`.

KEYWORD_READY means page coverage is ready for keyword retrieval. READY requires successful local embedding indexing when enabled. A configured worker/indexing failure marks processing failed; successful vectors remain reusable for retry. Empty or failed pages prevent readiness; nonempty low-confidence OCR remains flagged and its citations carry warnings.

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

Configure DATABASE_URL, a random JWT_SECRET and CLIENT_URL in server/.env. Existing answer-provider settings remain separate from the local retrieval model. Production requires a unique JWT secret of at least 32 characters and rejects known development placeholders. No frontend secrets are needed. CORS allows the configured client origin.

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
npm run test:api --prefix server
npm run eval:rag --prefix server
npm run eval:hybrid --prefix server
npm run test:ocr --prefix server
```

Integration tests use the configured PostgreSQL database, create isolated test owners/documents, and remove their own records/files afterward. Run against a development database. The older full application E2E script uses seeded development users and creates sample documents/drafts.

Evaluation fixtures cover explicit payment, long-document retrieval, clause identifiers, dates/amounts, absent answers, conflicting terms, Marathi text, low-quality OCR and cross-user access. Synthetic Marathi text fixtures test token handling only; the separate OCR suite executes the image-only PDF.

Current hybrid measurements are in [the raw benchmark](server/evaluations/last-hybrid-results.json). It compares BM25, reconstructed cosine-only retrieval, hybrid RRF, and both reranked variants on identical local vectors. It uses synthetic excerpts plus real extraction of the synthetic NDA PDF. Warm times include local query encoding and in-memory ranking, excluding database, network and answer generation; cold model startup is reported separately. Unsupported semantic queries still return neighbors, so candidates are not treated as proof of support. The full API run records [its checks separately](server/evaluations/last-hybrid-api-results.json) with controlled synthetic generation. Earlier audit/output files are historical records of previous implementations.

## Known limits

- The mixed-language scan contains two text pages and a blank third page. OCR confidence was low, and a live generated Marathi answer was withheld because it could not be verified. Production chat blocks this document until the blank/failed page is reviewed. Marathi-English reliability is not established.
- The synthetic fixtures and sample PDFs are not a representative production legal corpus. Native-speaker review of real scans, cross-language semantic queries, ambiguous terms and numeric OCR errors is still required.
- The current lightweight reranker showed no additional quality gain over hybrid RRF in the measured corpus. A learned local cross-encoder would require its own runtime/model evaluation before adoption.
- Chat questions are evaluated independently; previous assistant messages are not fed back as contract evidence. Explicitly name a clause or subject in follow-up questions.
- Summaries, clause/completeness analyses, and obligation extraction use local rules over shared extracted text; they have not been validated as legal advice.
