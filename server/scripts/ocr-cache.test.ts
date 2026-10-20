import { it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { PaddleOcrService } from '../src/services/ocr/paddle-ocr.service.js';
import { OcrCacheService } from '../src/services/ocr/ocr-cache.service.js';

it('retries only an empty cached page and preserves successful cached OCR', async () => {
  const good = { pageNumber: 1, text: 'Synthetic payment terms', confidence: 0.8, wordCount: 3, lineCount: 1 };
  const cache = mock.method(OcrCacheService, 'get', () => ({ engine: 'paddleocr', model: 'devanagari', dpi: 200,
    docHash: 'test', cachedAt: 'test', pages: [good, { ...good, pageNumber: 2, text: '', wordCount: 0 }] }));
  const saved = mock.method(OcrCacheService, 'set', () => {});
  const worker = mock.method(PaddleOcrService as any, 'runWorker', async (job: any, progress: any) => {
    assert.deepEqual(job.pages, [{ pageNumber: 2 }]);
    progress({ type: 'progress', pageNumber: 2, completedPages: 1, totalPages: 1, confidence: 0.6, wordCount: 2 });
    return { pages: [{ ...good, pageNumber: 2, text: 'Reviewed payment', confidence: 0.6, wordCount: 2 }] };
  });
  const progress: any[] = [];
  try {
    const result = await PaddleOcrService.analyzeScannedPages('sample_contracts/sample_nda.pdf', [1, 2], p => progress.push(p));
    assert.equal(result.pages.get(1)?.text, good.text);
    assert.equal(result.pages.size, 2);
    assert.equal(result.overallConfidence, 0.7);
    assert.equal(worker.mock.callCount(), 1);
    assert.equal(saved.mock.callCount(), 1);
    assert.equal(progress.at(-1).completedPages, 2);
    assert.equal(progress.at(-1).totalPages, 2);
  } finally { cache.mock.restore(); saved.mock.restore(); worker.mock.restore(); }
});
