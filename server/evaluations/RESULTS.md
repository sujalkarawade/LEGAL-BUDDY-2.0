# RAG verification results

For the subsequent stabilization audit and current test counts, see [AUDIT.md](AUDIT.md). The observations below describe the earlier implementation session. `last-e2e-results.json` was subsequently refreshed by an offline baseline run (21/22, generation disabled), so it no longer represents the historical credit-limited run. The new controlled-provider API run is saved separately in `last-api-audit-results.json`.

Recorded 18–19 October 2026 on the local Windows development environment. These are synthetic development fixtures, not a production accuracy benchmark. No Gemini key was configured. Live answers used the existing OpenRouter configuration (`meta-llama/llama-3.3-70b-instruct`); retrieval in live runs used keyword fallback.

## Automated checks

- `npm run test:rag`: **20/20 passed**. Covers chunk fidelity and overlap, Marathi token preservation, vector compatibility, embedding retries and malformed responses, strict citation validation, bounded Gemini context, fabricated references, outages and provider credit errors. Embedding/Gemini HTTP is mocked.
- `npm run test:rag:integration`: **14/14 passed** against actual PostgreSQL and HTTP routes. Covers ownership isolation (including vector candidates and jobs), nested-resource mutations, ingestion, retries, unchanged chunk reuse, partial OCR verification, failed embedding checkpoints, missing-page readiness, incompatible indexes and a document changing while an answer is generated. External AI is disabled/mocked.
- `npm run eval:rag`: **8/8 retrieval fixtures passed**, including the 40-filler-page long-document case, exact clause, dates/amounts, absent answer, conflicting passages and Marathi text. This checks passage retrieval, page identity and source validation; it does not measure generated-answer accuracy. The latest [raw results](last-retrieval-results.json) include fixture inputs, SHA-256, retrieval latency and total evaluation time.
- `npm run test:ocr`: **all assertions passed** with the existing local PaddleOCR models. The initial sandbox run could not read the model cache; the rerun with model access passed. Covers digital PDFs, image-only mixed-language pages, selective page preservation and blank-page flags.
- Backend TypeScript and frontend production builds passed. Prisma client generation and migration deployment succeeded without a database reset.
- Full running-application E2E: **21/22 passed**. The supporting chat-answer/citation check failed because OpenRouter returned HTTP **402 (insufficient credit)**. This remains a failed live check, not a passing citation test. Login, upload, review, summaries, clause analysis, completeness, obligations, unsupported-question handling, cross-user isolation, template generation, DOCX download and dashboard checks passed. See [raw E2E results](last-e2e-results.json).

## Live PDF observations

See [raw PDF results](last-live-results.json), executed 18 October. The older adapter labeled the OpenRouter-compatible client `groq`; this provider label has since been corrected to `openrouter`.

- NDA liability cap: retrieved page 2, answered USD 50,000 with the exact supporting excerpt. Retrieval 4.58 ms; generation 6,925.03 ms; total including extraction 7,106.84 ms.
- NDA effective date: retrieved page 1, answered 15 October 2026 with the exact supporting excerpt. Retrieval 0.72 ms; generation 4,182.04 ms; total 4,182.83 ms.
- Absent late-shipment penalties: returned insufficient evidence with no citations. Retrieval 2.96 ms; total 3.19 ms.
- Scanned Marathi-English payment question: retrieved the page-2 passage containing 50,000, but the generated answer could not be verified and was withheld. Retrieval 2.35 ms; total including OCR 43,565.75 ms. Aggregate OCR confidence was 0.495 and page 3 was blank/unreadable. Production chat correctly requires review of missing pages before readiness.

The English outputs above were compared with their saved excerpts; amounts, dates and page references match. These few observations do not establish general answer accuracy. Marathi transcription and translation require native-speaker review.

## Live text fixture observations

[Saved generated outputs](last-generated-results.json), executed 19 October, contain actual answers and timings. Explicit payment and date/amount answers matched their excerpts. The conflicting-notice answer identified both 60-day and 30-day terms and cited pages 3 and 11. The absent-answer and unclear-OCR cases abstained. The synthetic Marathi text answer included the amount and an OCR warning; this case did not run OCR.

Two fixtures in that live run were under-specified: the long-document question asked about notification timing but supplied only a cure period, and clause 7.2 supplied only a heading. Both generated answers abstained. The long-document question and clause passage were corrected afterward; the conflict passages were also expanded to state the termination subject explicitly. All corrected fixtures passed deterministic retrieval. **Live generation has not been rerun on the corrected fixtures because provider credit is insufficient.** Do not interpret the saved live outputs as results for the current fixture revision. Future runs record the exact fixture inputs and hash.

## Remaining validation

- Supply a working backend Gemini key and run live document/query embeddings and Gemini generation. Controlled-vector tests cannot establish multilingual semantic quality.
- Restore provider availability before rerunning the full application E2E and corrected live fixtures. Provider failures now return an explicit service/credit explanation and no confirmed citations.
- Evaluate representative real Marathi-English scans, numeric OCR errors, cross-language queries and legally ambiguous passages with a native speaker and qualified reviewer. Current samples do not establish reliable Marathi support.
- Measure production-scale documents before selecting a semantic relevance threshold or moving exact vector search into pgvector. No accuracy score or calibrated similarity percentage is claimed.
- Exact citation validation confirms source identity and excerpt presence, not complete logical entailment of every generated explanation.

## Reproduce

Follow [setup and migrations](../../RAG.md), then run the verification commands there. `npm run eval:rag -- --live` from `server` enables live generation for the synthetic text cases. `npx tsx scripts/evaluate-live-rag.ts` runs extraction/OCR and generation on the sample PDFs. Both live commands may consume configured provider credits. Use a development database; the full application E2E uses seeded users and leaves sample documents for inspection.
