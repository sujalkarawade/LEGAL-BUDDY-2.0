import { it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { RagService, retrievalTimeout, type RagChunk } from './rag.service.js';
import { LocalEmbeddingService } from './local-embedding.service.js';
import { RAG_RRF_K } from '../config/index.js';

const signature = 'fixture:3:v1';
const chunk = (id: string, content: string, v: number[], index = 0): RagChunk => ({
  id, documentId: 'doc', ownerId: 'owner', documentName: 'Contract.pdf', chunkIndex: index,
  pageNumber: index + 1, content, extractionMethod: 'selectable', clauseHeading: null,
  embedding: JSON.stringify(v), embeddingModel: signature,
});
const opts = { signature, queryVector: [1, 0, 0], limit: 2, rerank: false };
it('fuses semantic and BM25 ranks by chunk identity using the configured RRF formula', () => {
  const data = [
    chunk('exact', '7.2 Governing Law. Maharashtra law applies.', [0.8, 0.2, 0], 1),
    chunk('near', 'The contract is subject to the governing national laws.', [1, 0, 0], 0),
  ];
  const result = RagService.rank('What does section 7.2 say?', data, { ...opts, mode: 'hybrid' });
  assert.equal(result.chunks[0].id, 'exact');
  assert.ok(result.chunks[0].score > result.chunks[1].score);
  assert.ok(Math.abs(result.chunks[0].score - (1 / (RAG_RRF_K + 1) + 1 / (RAG_RRF_K + 2))) < 1e-12);
  assert.equal(new Set(result.chunks.map(c => c.id)).size, result.chunks.length);
  assert.equal(result.stats.mode, 'semantic_hybrid');
});
it('supports paraphrases through vectors without inventing keyword matches', () => {
  const data = [chunk('termination', 'Either party may terminate by giving thirty days written notice.', [1,0,0]),
    chunk('insurance', 'The supplier must maintain insurance certificates.', [0,1,0], 1)];
  const keyword = RagService.rank('I wish to walk away', data, { ...opts, mode: 'keyword' });
  const semantic = RagService.rank('I wish to walk away', data, { ...opts, mode: 'semantic' });
  const hybrid = RagService.rank('I wish to walk away', data, { ...opts, mode: 'hybrid' });
  assert.equal(keyword.chunks.length, 0);
  assert.equal(semantic.chunks[0].id, 'termination');
  assert.equal(hybrid.chunks[0].id, 'termination');
});
it('matches exact section numbers, quoted parties, dates and amounts without prefix collisions', () => {
  const data = [chunk('7.20', '7.20 Payment by Other Ltd on 2026-04-02: INR 500.', [1,0,0]),
    chunk('7.2', '7.2 Payment by Acme Holdings on 2026-04-01: INR 240,000.', [0,1,0], 1)];
  for (const question of ['Section 7.2', '"Acme Holdings"', '2026-04-01', 'INR 240000']) {
    assert.equal(RagService.rank(question, data, { ...opts, mode: 'keyword' }).chunks[0].id, '7.2', question);
  }
});
it('optional local reranking improves the exact heading while preserving all source and OCR metadata', () => {
  const wrong = chunk('wrong', 'Service quality issues. Separate credit terms are in a schedule.', [1,0,0], 0);
  const correct = { ...chunk('correct', 'Service Credit. A service credit of INR 500 applies.', [0.8,0.2,0], 1),
    clauseHeading: 'Service Credit', extractionMethod: 'paddle_ocr', lowConfidence: true, ocrReviewFlags: ['flagged'] };
  const off = RagService.rank('service credit', [wrong, correct], { ...opts, mode: 'hybrid' });
  const on = RagService.rank('service credit', [wrong, correct], { ...opts, mode: 'hybrid', rerank: true });
  assert.equal(off.chunks[0].id, 'wrong');
  assert.equal(on.chunks[0].id, 'correct');
  assert.equal(on.stats.rerankApplied, true);
  for (const key of ['id','documentId','ownerId','pageNumber','extractionMethod','lowConfidence','ocrReviewFlags'] as const) {
    assert.deepEqual(on.chunks[0][key], correct[key]);
  }
});
it('ignores incompatible, malformed and zero vectors without silently mixing models', () => {
  const data = [chunk('good', 'Payment fee', [1,0,0]), { ...chunk('old', 'Payment', [1,0,0], 1), embeddingModel: 'old' },
    { ...chunk('bad', 'Payment', [1,0,0], 2), embedding: '[1,2]' }, chunk('zero', 'Payment', [0,0,0], 3)];
  assert.deepEqual(RagService.rank('fee', data, { ...opts, mode: 'semantic' }).chunks.map(c => c.id), ['good']);
});
it('returns no keyword candidates for missing evidence, empty queries or failed OCR placeholders', () => {
  const data = [chunk('payment', 'Payment fee INR 500', [1,0,0]), { ...chunk('failed', 'court jurisdiction', [1,0,0]), extractionMethod: 'failed' }];
  for (const question of ['jurisdiction court', 'what is the', '']) {
    assert.equal(RagService.rank(question, data, { mode: 'keyword' }).chunks.length, 0);
  }
});
it('reranking timeout preserves the unmodified RRF order', () => {
  const data = [chunk('a', 'service credit', [1,0,0]), chunk('b', 'service fee', [0.8,0.2,0], 1)];
  const expected = RagService.rank('service credit', data, { ...opts }).chunks.map(c => c.id);
  let calls = 0;
  const now = mock.method(performance, 'now', () => calls++ * 1000);
  try {
    const result = RagService.rank('service credit', data, { ...opts, rerank: true });
    assert.equal(result.stats.rerankTimedOut, true);
    assert.equal(result.stats.rerankApplied, false);
    assert.deepEqual(result.chunks.map(c => c.id), expected);
  } finally { now.mock.restore(); }
});
it('query-embedding outages fall back safely and never log confidential exception text', async () => {
  const enabled = mock.method(LocalEmbeddingService, 'enabled', () => true, { getter: true });
  const info = mock.method(LocalEmbeddingService, 'getInfo', async () => ({ signature, dimensions: 3 }));
  const embed = mock.method(LocalEmbeddingService, 'embed', async () => { throw new Error('PRIVATE CONTRACT SENTINEL'); });
  const log = mock.method(console, 'warn', () => {});
  try {
    const result = await RagService.search('payment', [chunk('payment', 'payment fee INR 500', [1,0,0])]);
    assert.equal(result.stats.mode, 'keyword_fallback');
    assert.equal(result.stats.semanticStatus, 'unavailable');
    assert.equal(result.chunks[0].id, 'payment');
    assert.ok(!JSON.stringify(log.mock.calls).includes('PRIVATE CONTRACT'));
  } finally { enabled.mock.restore(); info.mock.restore(); embed.mock.restore(); log.mock.restore(); }
});
it('bounds asynchronous retrieval waits', async () => {
  await assert.rejects(retrievalTimeout(new Promise(() => {}), 5), /timed out/);
});
it('marks partial vector coverage explicitly while excluding incompatible vectors', async () => {
  const enabled = mock.method(LocalEmbeddingService, 'enabled', () => true, { getter: true });
  const info = mock.method(LocalEmbeddingService, 'getInfo', async () => ({ signature, dimensions: 3 }));
  const embed = mock.method(LocalEmbeddingService, 'embed', async () => [[1, 0, 0]]);
  try {
    const result = await RagService.search('payment', [chunk('current', 'payment fee', [1,0,0]),
      { ...chunk('legacy', 'payment schedule', [1,0,0], 1), embeddingModel: 'old-model' }]);
    assert.equal(result.stats.semanticStatus, 'partial');
    assert.equal(result.stats.mode, 'semantic_hybrid');
    assert.equal(result.chunks.find(c => c.id === 'legacy')?.semanticMatched, false);
  } finally { enabled.mock.restore(); info.mock.restore(); embed.mock.restore(); }
});
