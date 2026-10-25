import fs from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { RagService, type RagChunk } from '../src/services/rag.service.js';
import { validateGroundedAnswer } from '../src/services/grounded-answer.js';
const fixtureSource = fs.readFileSync('evaluations/rag-cases.json', 'utf8');
const fixture = JSON.parse(fixtureSource);
const rows = [];
for (const item of fixture.cases) {
  if (item.id === 'cross-user-document') continue; // Exercised through HTTP and real DB in integration tests.
  const expected = Array.isArray(item.expectedEvidence) ? item.expectedEvidence : item.expectedEvidence ? [item.expectedEvidence] : [];
  const pages = Array.isArray(item.expectedPage) ? item.expectedPage : [item.expectedPage];
  const chunks: RagChunk[] = Array.from({ length: 40 }, (_, i) => ({ id: `filler-${i}`, documentId: 'synthetic',
    chunkIndex: i, pageNumber: i + 1, content: 'Supplier shall retain insurance certificates and confidential records.',
    extractionMethod: 'selectable', clauseHeading: null }));
  expected.forEach((text: string, i: number) => chunks.push({ ...chunks[0], id: `expected-${i}`, content: text,
    chunkIndex: chunks.length, pageNumber: pages[i], extractionMethod: /scan|ocr/.test(item.id) ? 'paddle_ocr' : 'selectable' }));
  const start = performance.now();
  const retrieved = await RagService.retrieve(item.question, chunks);
  const retrievalMs = performance.now() - start;
  const hit = expected.length ? expected.every((_: string, i: number) => retrieved.some(c => c.id === `expected-${i}` && c.pageNumber === pages[i])) : retrieved.length === 0;
  assert.ok(hit, item.id);
  const validated = validateGroundedAnswer(JSON.stringify({ answer: item.expectedAnswer,
    insufficientEvidence: !expected.length, sources: expected.map((excerpt: string, i: number) => ({ chunkId: `expected-${i}`, excerpt })) }), retrieved, 'Synthetic contract');
  rows.push({ id: item.id, question: item.question, expectedEvidence: expected, expectedPages: pages,
    expectedAnswer: item.expectedAnswer, correctPassageRetrieved: hit, correctPage: validated.citations.every(c => pages.includes(c.pageNumber)),
    citationValidationPassed: true, generated: null, generatedAnswerAccuracy: 'NOT MEASURED: expected answer is a validator fixture, not legal accuracy',
    retrievalMs: +retrievalMs.toFixed(2), totalMs: +(performance.now() - start).toFixed(2) });
}
fs.writeFileSync('evaluations/last-retrieval-results.json', JSON.stringify({
  executedAt: new Date().toISOString(), fixtureSha256: createHash('sha256').update(fixtureSource).digest('hex'),
  mode: 'keyword_fallback', data: 'Synthetic text; Marathi cases do not execute OCR.', rows,
}, null, 2));
console.log(JSON.stringify(rows, null, 2));
