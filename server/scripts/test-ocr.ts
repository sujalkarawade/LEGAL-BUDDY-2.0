import { PdfService } from '../src/services/pdf-service.js';
import { PaddleOcrService } from '../src/services/ocr/paddle-ocr.service.js';

const NDA = './sample_contracts/sample_nda.pdf';
const MIXED = './sample_contracts/sample_marathi_en_scanned.pdf';
const EMPTY = './sample_contracts/sample_empty_scanned.pdf';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  PASS: ${msg}`);
  } else {
    failures++;
    console.error(`  FAIL: ${msg}`);
  }
}

async function main() {
  console.log('=== Local PaddleOCR pipeline test ===\n');

  // 0. Engine is always considered available (no credentials required).
  assert(PaddleOcrService.isConfigured(), 'PaddleOCR service reports configured=true (no Azure creds)');

  // 1. Digital selectable PDF -> should NOT need OCR, high confidence, pages preserved.
  console.log('\n--- 1. Digital selectable PDF (sample_nda.pdf) ---');
  const nda = await PdfService.extractText(NDA);
  console.log('  pages:', nda.pageCount, '| selectable:', nda.ocrResult.selectablePagesCount, '| scanned:', nda.ocrResult.scannedPagesCount);
  assert(nda.pageCount > 0, 'NDA page count > 0');
  assert(nda.ocrResult.scannedPagesCount === 0, 'NDA has 0 scanned pages (pure digital)');
  assert(nda.ocrResult.selectablePagesCount === nda.pageCount, 'NDA all pages selectable');
  assert(nda.ocrResult.ocrEngineUsed === 'selectable_direct', 'NDA engine = selectable_direct (no OCR run)');
  assert(nda.ocrResult.overallConfidence === 1.0, 'NDA confidence = 1.0 (direct text)');
  assert(nda.chunks.length > 0, 'NDA produced RAG chunks');

  // 2. Mixed English-Marathi scanned PDF -> PaddleOCR must extract Devanagari + English.
  console.log('\n--- 2. Mixed English-Marathi scanned PDF ---');
  const mixed = await PdfService.extractText(MIXED);
  console.log('  pages:', mixed.pageCount, '| scanned:', mixed.ocrResult.scannedPagesCount, '| selectable:', mixed.ocrResult.selectablePagesCount);
  console.log('  languages:', mixed.ocrResult.detectedLanguages, '| confidence:', mixed.ocrResult.overallConfidence);
  assert(mixed.pageCount > 0, 'Mixed page count > 0');
  assert(mixed.ocrResult.scannedPagesCount > 0, 'Mixed has scanned pages detected');
  assert(mixed.ocrResult.ocrEngineUsed === 'paddle_ocr', 'Mixed engine = paddle_ocr');
  const hasDevanagari = mixed.text.length > 0 && /[\u0900-\u097F]/.test(mixed.text);
  assert(hasDevanagari, 'Mixed extracted text contains Devanagari (Marathi) characters');
  assert(mixed.text.trim().length > 0, 'Mixed produced non-empty extracted text');
  assert(mixed.ocrResult.pages.length === mixed.pageCount, 'Per-page metadata preserved for every page');

  // 3. Empty scanned PDF -> graceful, flagged, no crash.
  console.log('\n--- 3. Empty scanned PDF (graceful handling) ---');
  try {
    const empty = await PdfService.extractText(EMPTY);
    console.log('  pages:', empty.pageCount, '| scanned:', empty.ocrResult.scannedPagesCount);
    assert(empty.ocrResult.pages.length === empty.pageCount, 'Empty: per-page metadata preserved');
    const anyFlagged = empty.ocrResult.pages.some((p) => p.flagged);
    assert(anyFlagged, 'Empty: at least one page flagged for review');
    console.log('  handled gracefully without throwing.');
  } catch (e: any) {
    console.error('  Empty PDF handling threw:', e?.message);
    failures++;
  }

  console.log('\n=== ' + (failures === 0 ? 'ALL TESTS PASSED' : `${failures} TEST(S) FAILED`) + ' ===');
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});

