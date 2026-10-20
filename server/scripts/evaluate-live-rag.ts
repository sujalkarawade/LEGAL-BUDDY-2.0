import fs from 'node:fs';
import { PdfService } from '../src/services/pdf-service.js';
import { RagService } from '../src/services/rag.service.js';
import { AIAdapter } from '../src/services/ai/ai-adapter.js';
import { PaddleOcrService } from '../src/services/ocr/paddle-ocr.service.js';
const rows: unknown[] = [];
try {
  const cases = [
    { file: 'sample_nda.pdf', question: 'What is the liability cap?', expectedPage: 2, expectedText: '$50,000' },
    { file: 'sample_nda.pdf', question: 'What is the effective date?', expectedPage: 1, expectedText: 'October 15, 2026' },
    { file: 'sample_nda.pdf', question: 'What are the late shipment penalties?', expectedPage: null, expectedText: null },
    { file: 'sample_marathi_en_scanned.pdf', question: 'पेमेंट किती आहे?', expectedPage: 2, expectedText: '50,000' },
  ];
  const extracted = new Map<string, Awaited<ReturnType<typeof PdfService.extractText>>>();
  for (const item of cases) {
    const totalStart = performance.now();
    let doc = extracted.get(item.file);
    if (!doc) { doc = await PdfService.extractText(`sample_contracts/${item.file}`); extracted.set(item.file, doc); }
    const vectors = await RagService.embedChunks(doc.chunks);
    const chunks = doc.chunks.map((chunk, i) => ({ ...chunk, ...vectors[i], id: `sample-${i}`, documentId: item.file, clauseHeading: chunk.clauseHeading || null }));
    const retrievalStart = performance.now();
    const retrieved = await RagService.retrieve(item.question, chunks);
    const retrievalMs = performance.now() - retrievalStart;
    const evidence = retrieved.map(c => ({ ...c, lowConfidence: doc!.ocrResult.pages.find(p => p.pageNumber === c.pageNumber)?.hasLowConfidence || false }));
    const answerStart = performance.now();
    const answer = await AIAdapter.answerQuestion(item.question, evidence, [], item.file);
    const row = { ...item, retrievalMs: +retrievalMs.toFixed(2), answerMs: +(performance.now() - answerStart).toFixed(2),
      totalMsIncludingExtraction: +(performance.now() - totalStart).toFixed(2),
      expectedPassageRetrieved: item.expectedPage === null ? null : retrieved.some(c => c.pageNumber === item.expectedPage && c.content.includes(item.expectedText!)),
      missingPages: doc.ocrResult.pages.filter(p => !p.text.trim()).map(p => p.pageNumber),
      ocrConfidence: doc.ocrResult.overallConfidence,
      answer, manualAnswerReview: 'pending',
    };
    rows.push(row);
    console.log(JSON.stringify(row));
  }
} finally {
  PaddleOcrService.shutdown();
  fs.writeFileSync('evaluations/last-live-results.json', JSON.stringify({ executedAt: new Date().toISOString(),
    semanticEmbeddingAvailable: RagService.embeddingEnabled, notice: 'Synthetic PDF samples only. Scan retrieval is measured directly; production chat blocks missing pages until verified.', rows }, null, 2));
}
