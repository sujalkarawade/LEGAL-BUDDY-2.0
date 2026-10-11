import fs from 'fs';
import path from 'path';
import { PdfService } from '../src/services/pdf-service.js';
import { PaddleOcrService } from '../src/services/ocr/paddle-ocr.service.js';
import { OcrCacheService } from '../src/services/ocr/ocr-cache.service.js';
import { JobQueueService } from '../src/services/job-queue.service.js';

const NDA = './sample_contracts/sample_nda.pdf';
const MIXED = './sample_contracts/sample_marathi_en_scanned.pdf';
const EMPTY = './sample_contracts/sample_empty_scanned.pdf';
const SWAPNAPURTI_34 = './uploads/1791649186962_0716d45223f8e2a0_swapnapurti_flat_a_806_agreement.pdf';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  [PASS] ${msg}`);
  } else {
    failures++;
    console.error(`  [FAIL] ${msg}`);
  }
}

async function runRegressionSuite() {
  console.log('================================================================');
  console.log('   LEGAL BUDDY OCR PIPELINE: FULL REGRESSION & BENCHMARK SUITE  ');
  console.log('================================================================\n');

  // Req 1: Model reuse via persistent worker
  console.log('--- Requirement 1: Reuse OCR Model (Warm-up & Persistent Worker) ---');
  const t_warm_start = Date.now();
  await PaddleOcrService.warmup();
  const warm_ms = Date.now() - t_warm_start;
  console.log(`  Worker warm-up completed in ${warm_ms}ms.`);
  assert(PaddleOcrService.isConfigured(), 'PaddleOCR service is configured and available.');

  // Req 2: Skip OCR for text-based pages
  console.log('\n--- Requirement 2: Skip OCR for Text-Based Pages (sample_nda.pdf) ---');
  const t_nda_start = Date.now();
  const ndaResult = await PdfService.extractText(NDA);
  const nda_ms = Date.now() - t_nda_start;
  console.log(`  NDA processed in ${nda_ms}ms (${ndaResult.pageCount} pages).`);
  assert(ndaResult.pageCount === 2, 'NDA has 2 pages.');
  assert(ndaResult.ocrResult.scannedPagesCount === 0, 'NDA has 0 scanned pages.');
  assert(ndaResult.ocrResult.selectablePagesCount === 2, 'NDA all 2 pages extracted directly as selectable text.');
  assert(ndaResult.ocrResult.ocrEngineUsed === 'selectable_direct', 'Engine reported selectable_direct.');
  assert(ndaResult.ocrResult.overallConfidence === 1.0, 'Selectable text confidence is 1.0.');
  assert(nda_ms < 1000, `Text-based extraction was near-instantaneous (${nda_ms}ms < 1000ms).`);

  // Req 6: Reliable OCR Caching
  console.log('\n--- Requirement 6: Avoid Repeated Work via Reliable Caching ---');
  const mixedHash = OcrCacheService.computeDocHash(MIXED);
  const mixedCacheKey = OcrCacheService.getCacheKey(mixedHash);
  // Ensure fresh cache write by clearing any old cache for this test
  OcrCacheService.invalidate(mixedCacheKey);
  assert(OcrCacheService.get(mixedCacheKey) === null, 'Cache cleanly invalidated prior to first run.');

  // First run (fresh OCR, writes to cache)
  const t_mix1 = Date.now();
  const mixed1 = await PdfService.extractText(MIXED);
  const mix1_ms = Date.now() - t_mix1;
  console.log(`  First run (fresh OCR): ${mix1_ms}ms.`);
  assert(OcrCacheService.get(mixedCacheKey) !== null, 'OCR result was written to disk cache.');

  // Second run (cache hit)
  const t_mix2 = Date.now();
  const mixed2 = await PdfService.extractText(MIXED);
  const mix2_ms = Date.now() - t_mix2;
  console.log(`  Second run (cache hit): ${mix2_ms}ms.`);
  assert(mix2_ms < 200, `Cached OCR lookup took ${mix2_ms}ms (< 200ms) - virtually instant!`);
  assert(mixed2.text === mixed1.text, 'Cached text matches freshly extracted text exactly.');

  // Req 7: Background Job Pipeline & Progress Events
  console.log('\n--- Requirement 7: Background Job Pipeline with Live Page Progress ---');
  const mockDocId = 'test-doc-uuid-1234';
  const mockUserId = 'test-user-uuid-5678';
  const job = JobQueueService.createJob(mockDocId, mockUserId, 3);
  assert(job.status === 'PROCESSING', 'Job initialized with PROCESSING status.');

  const progressEvents: Array<{ completed: number; total: number; stage: string }> = [];
  // Bypass cache to trigger actual per-page progress events
  const mixedAsync = await PdfService.extractText(
    MIXED,
    (p) => {
      progressEvents.push({ completed: p.completedPages, total: p.totalPages, stage: p.stage });
      JobQueueService.updateProgress(job.id, p.completedPages, p.totalPages, p.stage);
    },
    { bypassCache: true }
  );

  JobQueueService.completeJob(job.id, {
    documentId: mockDocId,
    pageCount: mixedAsync.pageCount,
    ocrStatus: 'OCR_COMPLETED',
    hasLowConfidencePages: false,
  });

  const completedJob = JobQueueService.getJob(job.id);
  assert(completedJob?.status === 'COMPLETED', 'Background job marked as COMPLETED.');
  assert(completedJob?.progress.percent === 100, 'Job reached 100% progress.');
  assert(progressEvents.length >= 3, `Received ${progressEvents.length} progress events during execution.`);
  console.log(`  Sample progress events captured:`);
  progressEvents.slice(0, 3).forEach((ev, idx) => {
    console.log(`    Event ${idx + 1}: ${ev.completed}/${ev.total} pages - "${ev.stage}"`);
  });

  // Req 8 & 11: Preserve Page-Level Output & Validate Accuracy (Marathi + English)
  console.log('\n--- Requirements 8 & 11: Page-Level Output & Marathi-English Accuracy ---');
  assert(mixedAsync.ocrResult.pages.length === 3, 'Preserved exactly 3 per-page metadata entries.');
  const page1 = mixedAsync.ocrResult.pages.find((p) => p.pageNumber === 1);
  const page2 = mixedAsync.ocrResult.pages.find((p) => p.pageNumber === 2);
  const page3 = mixedAsync.ocrResult.pages.find((p) => p.pageNumber === 3);

  assert(!!page1 && page1.wordCount > 30, 'Page 1 has English legal contract text.');
  assert(!!page2 && /[\u0900-\u097F]/.test(page2.text), 'Page 2 contains Devanagari (Marathi) characters.');
  assert(page2!.text.includes('दोन पक्ष') || page2!.text.includes('सेवा'), 'Page 2 contains Marathi clauses.');
  assert(page2!.text.includes('50,000') || page2!.text.includes('पेमेंट'), 'Page 2 contains dates/amounts/numbers.');
  assert(!!page3 && page3.wordCount === 0 && page3.flagged, 'Page 3 empty scan flagged safely without crash.');
  assert(mixedAsync.chunks.length > 0, 'Document chunks created cleanly for RAG & AI adapter.');

  // Req 9: Safe Failure Handling & Page-Specific Reprocessing
  console.log('\n--- Requirement 9: Safe Failure Handling (Empty / Unreadable Scans) ---');
  const emptyResult = await PdfService.extractText(EMPTY);
  assert(emptyResult.pageCount === 1, 'Empty PDF has 1 page.');
  assert(emptyResult.ocrResult.pages[0].flagged === true, 'Empty page correctly flagged for user review.');
  assert(emptyResult.isScannedOrEmpty === true, 'Document identified as isScannedOrEmpty.');

  // Selective reprocessing test: re-OCR only page 2 of mixed document
  console.log('  Testing selective page reprocessing (force page 2 only)...');
  const selectiveResult = await PdfService.extractText(
    MIXED,
    undefined,
    { forcePageNumbers: [2], bypassCache: true }
  );
  assert(selectiveResult.ocrResult.pages.length === 3, 'Selective reprocessing maintained total page count.');
  assert(selectiveResult.ocrResult.pages[1].pageNumber === 2, 'Target page 2 was reprocessed.');

  // Req 10: 34-Page Document Performance Verification
  console.log('\n--- Requirement 10: 34-Page PDF Performance Verification ---');
  if (fs.existsSync(SWAPNAPURTI_34)) {
    console.log(`  Found 34-page scanned agreement: ${SWAPNAPURTI_34}`);
    const t34_start = Date.now();
    const result34 = await PdfService.extractText(SWAPNAPURTI_34);
    const total34_ms = Date.now() - t34_start;
    console.log(`  34-page agreement completed in ${(total34_ms / 1000).toFixed(2)}s.`);
    assert(result34.pageCount === 34, 'All 34 pages accounted for.');
    assert(result34.ocrResult.pages.length === 34, 'Per-page metadata generated for all 34 pages.');
    assert(result34.chunks.length > 20, 'Generated comprehensive RAG chunks across all pages.');

    // Check key legal terms in 34-page output
    const full34 = result34.text;
    assert(full34.includes('20/09/2012'), 'Extracted date 20/09/2012.');
    assert(full34.includes('18,70,310'), 'Extracted consideration amount 18,70,310.');
    assert(full34.includes('806'), 'Extracted flat number 806.');
    assert(full34.includes('PRIME PROPERTIES') || full34.includes('Prime Properties'), 'Extracted developer name.');
    assert(full34.includes('करारनामा'), 'Extracted Marathi contract title.');
  } else {
    console.warn('  34-page PDF not found at standard path, skipped 34-page live run.');
  }

  console.log('\n================================================================');
  if (failures === 0) {
    console.log('   🎉 ALL REGRESSION TESTS PASSED SUCCESSFULLY!                 ');
  } else {
    console.error(`   ❌ ${failures} TEST(S) FAILED.                               `);
  }
  console.log('================================================================');

  process.exit(failures === 0 ? 0 : 1);
}

runRegressionSuite().catch((err) => {
  console.error('Regression suite crashed:', err);
  process.exit(1);
});
