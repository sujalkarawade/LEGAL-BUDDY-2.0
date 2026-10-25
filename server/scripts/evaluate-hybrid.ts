import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { RagService, type RagChunk, type SearchMode } from '../src/services/rag.service.js';
import { LocalEmbeddingService } from '../src/services/local-embedding.service.js';
import { PdfService } from '../src/services/pdf-service.js';
import { validateGroundedAnswer } from '../src/services/grounded-answer.js';

const fixture = JSON.parse(fs.readFileSync('evaluations/hybrid-cases.json', 'utf8'));
const variants: Array<{ name: string; mode: SearchMode; rerank: boolean }> = [
  { name: 'keyword', mode: 'keyword', rerank: false },
  { name: 'semantic', mode: 'semantic', rerank: false },
  { name: 'semantic_reranked', mode: 'semantic', rerank: true },
  { name: 'hybrid', mode: 'hybrid', rerank: false },
  { name: 'hybrid_reranked', mode: 'hybrid', rerank: true },
];
const round = (n: number) => +n.toFixed(4);
const percentile = (xs: number[], p: number) => round([...xs].sort((a,b) => a-b)[Math.max(0, Math.ceil(xs.length * p) - 1)] || 0);
const rows: any[] = [];
try {
  assert.ok(LocalEmbeddingService.enabled, 'Install local weights and enable local embeddings before running this benchmark.');
  const coldStart = performance.now();
  const info = await LocalEmbeddingService.getInfo();
  assert.ok(info);
  const coldStartMs = performance.now() - coldStart;
  const raw: RagChunk[] = fixture.chunks.map((c: any, i: number) => ({
    extractionMethod: 'selectable', lowConfidence: false, ocrReviewFlags: [], ...c,
    chunkIndex: i, ownerId: 'synthetic-owner', documentName: c.documentId + '.pdf',
  }));
  for (let i = 0; i < 80; i++) raw.push({
    id: 'long-filler-' + i, documentId: 'long', chunkIndex: i, pageNumber: i + 1,
    content: 'For administrative record ' + i + ', supplier shall retain insurance certificates and confidential records for seven years.',
    extractionMethod: 'selectable', clauseHeading: null, ownerId: 'synthetic-owner', documentName: 'long.pdf',
  });
  // Selectable synthetic PDF: the expected excerpts/page numbers are checked against actual extraction.
  const nda = await PdfService.extractText('sample_contracts/sample_nda.pdf');
  const ndaChunks: RagChunk[] = nda.chunks.map((c, i) => ({ ...c, id: 'nda-' + i, documentId: 'nda',
    clauseHeading: c.clauseHeading || null, documentName: 'sample_nda.pdf', ownerId: 'synthetic-owner' }));
  raw.push(...ndaChunks);
  for (const [id, question, page, excerpt] of [
    ['nda-cap', 'What is the liability cap?', 2, '$50,000'],
    ['nda-date', 'What is the effective date?', 1, 'October 15, 2026'],
  ] as const) {
    const source = ndaChunks.find(c => c.pageNumber === page && c.content.includes(excerpt));
    assert.ok(source, 'Expected passage must exist on the known physical PDF page: ' + id);
    fixture.cases.push({ id, documentIds: ['nda'], question, relevantIds: [source.id] });
  }
  const encodingStarted = performance.now();
  const chunks: RagChunk[] = [];
  for (let offset = 0; offset < raw.length; offset += 8) {
    const batch = raw.slice(offset, offset + 8);
    const vectors = await LocalEmbeddingService.embed(batch.map(c => c.content));
    chunks.push(...batch.map((c, i) => ({ ...c, embedding: JSON.stringify(vectors[i]), embeddingModel: info.signature })));
  }
  const indexingMs = performance.now() - encodingStarted;
  for (const item of fixture.cases) {
    const selected = chunks.filter(c => item.documentIds.includes(c.documentId));
    const [queryVector] = await LocalEmbeddingService.embed([item.question], 'query');
    const outputs: any = {};
    for (const variant of variants) {
      const ranked = RagService.rank(item.question, selected, { ...variant, limit: 3, queryVector, signature: info.signature });
      const ids = ranked.chunks.map(c => c.id);
      const expected = item.relevantIds as string[];
      const first = ids.findIndex(id => expected.includes(id));
      for (const c of ranked.chunks) {
        const original = selected.find(s => s.id === c.id)!;
        assert.equal(c.pageNumber, original.pageNumber);
        assert.equal(c.documentId, original.documentId);
        assert.equal(c.ownerId, original.ownerId);
        assert.equal(c.lowConfidence, original.lowConfidence || false);
        const checked = validateGroundedAnswer(JSON.stringify({ answer: 'Retrieved source excerpt.', insufficientEvidence: false,
          sources: [{ chunkId: c.id, excerpt: c.content.slice(0, 500) }] }), [c], 'Wrong.pdf');
        assert.equal(checked.citations[0].documentName, c.documentName);
        assert.equal(checked.citations[0].pageNumber, c.pageNumber);
      }
      const scoringSamples: number[] = [];
      for (let repeat = 0; repeat < 10; repeat++) {
        const start = performance.now();
        RagService.rank(item.question, selected, { ...variant, limit: 3, queryVector, signature: info.signature });
        scoringSamples.push(performance.now() - start);
      }
      outputs[variant.name] = { topIds: ids, expectedIds: expected,
        top1Hit: expected.length ? expected.includes(ids[0]) : null,
        recallAt3: expected.length ? ids.filter(id => expected.includes(id)).length / expected.length : null,
        reciprocalRankAt3: expected.length ? (first < 0 ? 0 : 1 / (first + 1)) : null,
        unsupportedCandidates: expected.length ? null : ids.length, scoringSamplesMs: scoringSamples, warmRetrievalSamplesMs: [] };
    }
    // Rotate variant order between repeats; these times include actual warm local query encoding, no database/network/LLM.
    for (let repeat = 0; repeat < 3; repeat++) {
      const ordered = [...variants.slice(repeat), ...variants.slice(0, repeat)];
      for (const variant of ordered) {
        const start = performance.now();
        const result = await RagService.search(item.question, selected, { ...variant, limit: 3 });
        assert.ok(variant.mode === 'keyword' || result.stats.semanticStatus === 'available');
        outputs[variant.name].warmRetrievalSamplesMs.push(performance.now() - start);
      }
    }
    rows.push({ id: item.id, question: item.question, documentIds: item.documentIds, variants: outputs });
  }
  const summary: any = {};
  for (const variant of variants) {
    const measurements = rows.map(r => r.variants[variant.name]);
    const positive = measurements.filter(r => r.top1Hit !== null);
    const scoreTimes = measurements.flatMap(r => r.scoringSamplesMs);
    const warmTimes = measurements.flatMap(r => r.warmRetrievalSamplesMs);
    summary[variant.name] = {
      supportedCases: positive.length, top1Hits: positive.filter(r => r.top1Hit).length,
      meanRecallAt3: round(positive.reduce((n,r) => n + r.recallAt3, 0) / positive.length),
      meanReciprocalRankAt3: round(positive.reduce((n,r) => n + r.reciprocalRankAt3, 0) / positive.length),
      unsupportedCandidates: measurements.filter(r => r.unsupportedCandidates !== null).map(r => r.unsupportedCandidates),
      scoringP50Ms: percentile(scoreTimes, 0.5), scoringP95Ms: percentile(scoreTimes, 0.95),
      warmRetrievalP50Ms: percentile(warmTimes, 0.5), warmRetrievalP95Ms: percentile(warmTimes, 0.95),
    };
  }
  const report = { executedAt: new Date().toISOString(), embedding: info, coldStartMs: round(coldStartMs),
    indexingMs: round(indexingMs), chunks: chunks.length,
    fixtureSha256: createHash('sha256').update(JSON.stringify({ raw, cases: fixture.cases })).digest('hex'),
    scope: 'Synthetic corpus and actual selectable NDA extraction. In-memory ranking/query encoding; no DB/network/LLM in latency. Cosine-only baseline is reconstructed because the starting tree was keyword-only. No legal answer accuracy or OCR recognition accuracy measured.',
    summary, rows };
  fs.writeFileSync('evaluations/last-hybrid-results.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ embedding: info, coldStartMs: report.coldStartMs, indexingMs: report.indexingMs, chunks: chunks.length, summary }, null, 2));
} finally { LocalEmbeddingService.shutdown(); }
