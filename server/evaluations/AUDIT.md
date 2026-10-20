# RAG stabilization audit — 19–20 October 2026

## Scope and baseline

The audit started with inspection, before implementation edits. The working tree contained 25 modified tracked files and 20 untracked files from the prior upgrade. No changes were discarded, no history was rewritten, and no dependency, database, OCR engine or second retrieval pipeline was introduced. Frontend implementation files were preserved during this audit.

The earlier tracked changes covered README, the document header/dashboard/chat/OCR/repository/upload screens, frontend API/types, backend environment/scripts/Prisma schema, configuration/startup/authentication, the document controller, AI adapter/types, jobs and PDF/PaddleOCR services. Added files covered the RAG/access/source-validation services, embedding/retrieval/integration evaluations, migration SQL, RAG.md and recorded evaluation artifacts. Those changes were reviewed along with the original routes, upload middleware, Python worker, cache, database models and legacy test scripts.

The architecture already provided:

- PDF-only upload, selectable page extraction, a persistent local PaddleOCR worker and a document-hash cache.
- Page-aware overlapping chunks with document IDs, physical PDF page numbers, extraction method and optional clause heading.
- `gemini-embedding-001` embeddings, 768 dimensions, versioned in existing PostgreSQL chunk rows. Similarity is calculated after database owner/document filtering; no pgvector extension is used.
- Hybrid semantic/keyword retrieval, bounded passage context and Gemini/Groq/OpenRouter answer integration.
- JSON answer validation with exact excerpts and server-derived citation pages, uncertainty responses and OCR warnings.
- Existing summary, clauses, completeness and obligation features sharing extraction.

Before fixes, the existing 20 unit tests, 14 PostgreSQL/HTTP integration tests and both builds passed again. The unmodified full API script ran against an isolated server with provider keys disabled: 21/22 checks passed; the supporting-answer check failed because generation was intentionally unavailable. This audit did not repeat the historical live OpenRouter credit failure or call a live answer provider.

## Verified defects and fixes

1. **Offline mode ignored configured keys.** `AI_PROVIDER=heuristic` still selected a configured provider, and chat/embedding paths could call it. Heuristic mode now disables provider initialization, generation and embeddings. A regression test configures dummy keys and asserts zero external requests.
2. **Unchanged retries erased reviews.** Reprocessing always deleted/recreated analyses and reset review decisions. The processor now reuses analyses for identical extracted text. An internal `analysisTextHash` in existing OCR metadata tracks the analyzed revision. Changed analyses and their hash are committed atomically. Tests preserve clause approval, completeness review and acknowledged obligations across retries.
3. **Stale citations survived early failures.** Invalidation previously happened only while changing indexed chunks. Confirmed citations are now invalidated before extraction; chat history also hides citations while the document is not ready. Tests cover a formerly cited page becoming unreadable and a document changing during generation.
4. **Exceptions could disclose data.** Outer upload/retry handlers, job errors and the global handler exposed raw errors despite inner sanitization. Public errors and runtime logs now use fixed messages. Invalid upload/JSON and size errors retain useful 400/413 responses. Sentinel tests check responses, stored errors, jobs and logs. Other API controller error logs and corrupted OCR-cache diagnostics were also sanitized.
5. **Partial OCR cache reuse was missing.** One empty/failed cached page caused successful pages to be OCRed again. The cache now reuses readable pages individually, requests only missing/failed pages and adjusts progress counts. A controlled-worker test checks the exact requested page list; the real OCR suite verifies full-cache reuse and selected-page preservation.
6. **Devanagari chunks could disappear.** The text gate required adjacent Unicode letters, rejecting valid words separated by vowel marks. It now counts letters without removing combining marks. Empty chunk sets cannot become ready even if an extraction flag is inconsistent. Model-written page labels with Devanagari digits are also rejected.
7. **Hardcoded authentication fallback.** The historical JWT default was removed. Development without a configured secret uses a random process-local secret; production rejects missing, short and known placeholder/development values. Production configuration tests cover these cases. Existing credentials were not rotated silently.
8. **A benchmark asserted the wrong cache behavior.** The old OCR regression expected a repeat run with a blank page to complete in under 200 ms. It failed at 1,286 ms while correctly retrying that page. The assertion now verifies actual readable-page cache hits; timings remain observations. Selective retry checks now supply preserved pages and assert their text remains unchanged.

The full API test gained a separate controlled-provider runner, using the same existing test cases and actual routes, PostgreSQL, extraction, OCR, retrieval and citation validator. External HTTP requests are prohibited by that runner. Its provider stub is test-only; it is not an alternative production RAG implementation. The citation assertion now checks the excerpt against the actual extracted page. The runner cleans up its own database records and output files.

## Final verification

Commands below are run from the repository root unless prefixed with `cd server`.

- `npm run test:rag --prefix server`: **25/25 passed**; includes mocked Gemini/embedding contracts, source validation, retrieval, Devanagari chunking, offline mode, cache behavior, error redaction and production secret checks.
- `npm run test:rag:integration --prefix server`: **18/18 passed** against real PostgreSQL and HTTP routes. Covers authorization, actual extracted NDA sources/pages, OCR warnings, missing evidence, malformed inputs, unchanged reviews, embedding failures/retries, zero chunks and citation revision safety.
- `npm run test:api --prefix server`: **22/22 passed**, with a controlled answer provider. See [raw results](last-api-audit-results.json). This does not establish live model accuracy.
- `npm run eval:rag --prefix server`: **8/8 deterministic retrieval cases passed**. See [fixture snapshots and timings](last-retrieval-results.json). No generated-answer accuracy is inferred from these assertions.
- `npm run test:ocr --prefix server`: **17/17 assertions passed**, using actual local PaddleOCR and synthetic PDFs. Mixed-language aggregate confidence remained **0.495**.
- `cd server; npx tsx scripts/test-pipeline-regression.ts`: **all executed assertions passed** after correcting the outdated timing assumption. The optional private 34-page fixture was absent and was skipped. The observed final run took 275 ms for selectable NDA extraction, 8,609 ms for fresh three-page OCR, and 1,522 ms to reuse readable pages and retry the blank page. These are single observations, not service guarantees.
- `npm run build`: **server TypeScript and client TypeScript/Vite production builds passed**.
- `cd server; npx prisma validate`: schema valid.
- `cd server; npx prisma migrate status`: all three migrations applied.
- `cd server; npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code`: no difference, exit 0.
- Generated Prisma client schema comparison: equivalent to the source schema apart from formatting. Each applied migration checksum matched its local SQL file. **No new migration or client regeneration was needed for these fixes.**
- `git diff --check`: passed. Final changes were reviewed for unintended deletions and unrelated functionality changes.

The direct provider probes (`test-groq.ts`, `test-json.ts`, `test-all-ai.ts`) are manual demos, not assertion suites. They were not executed; the latter contains text derived from a named property agreement. No real confidential contract text was sent to an external provider during this audit. Historical live-output files were retained and are not current verification results.

## Security finding requiring deployment action

The configured development JWT value and local database connection credentials match values present in Git history. The JWT value also appeared in the original source fallback; that fallback has now been removed. Exact-value scans found no configured provider API key in the scanned tracked files/history and no configured secret values in the final source, added files or frontend build. `.env` is ignored and untracked. These checks do not certify that every possible historical secret has been detected.

Rotate the development JWT and database credentials before deploying or exposing this environment; JWT rotation invalidates sessions. The audit did not change credentials, reset the database or rewrite history. Production now rejects the historical JWT placeholder, so deployment with that value will fail until corrected.

## Readiness and limits

The existing implementation is a suitable **development baseline for the next controlled RAG enhancement**. It is not production-certified or a validated legal-answer system.

- No Gemini key was configured. Live embeddings, cross-language semantic retrieval and Gemini generation still need verification with an authorized working configuration.
- No live provider was called in this audit. Earlier OpenRouter credit exhaustion is historical evidence, not a fresh availability check.
- The Marathi-English sample is synthetic and low-confidence. Native-speaker review of representative scans, amounts/dates, mixed-language queries and legal ambiguity remains necessary.
- Citation validation confirms that a source ID and exact excerpt exist on an extracted page. It does not prove every generated interpretation logically follows from that source, that OCR is correct, or that retrieval found every relevant/contradictory clause.
- Retrieval scans one authorized document in Node; large collections and relevance thresholds still need evaluation. Previous conversation messages are not fed back as documentary evidence.
- Processing jobs remain in memory and support one backend worker. A restart requires retrying interrupted jobs. Changed document text intentionally requires fresh analysis/review; unchanged text preserves reviews.
- Strict chat citation validation does not extend automatically to every legacy summary/clause/completeness/obligation explanation.

See [RAG.md](../../RAG.md) for setup, API behavior and existing migration instructions.
