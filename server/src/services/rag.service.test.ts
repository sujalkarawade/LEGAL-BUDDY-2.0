import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RagService, authorizedChunkFilter, type RagChunk } from './rag.service.js';
import { PdfService } from './pdf-service.js';
import { isResourceOwner } from './document-access.service.js';

describe('RAG retrieval and authorization', () => {
  const chunk = (id: string, pageNumber: number, content: string): RagChunk => ({
    id, documentId: 'doc-a', chunkIndex: pageNumber, pageNumber, content,
    extractionMethod: 'selectable', clauseHeading: null, embedding: null, embeddingModel: null,
  });

  it('retrieves matching clauses and preserves page metadata without padding unrelated text', async () => {
    const results = await RagService.retrieve('termination notice period', [
      chunk('relevant', 8, 'Either party may terminate this Agreement with thirty days written notice.'),
      chunk('irrelevant', 17, 'The supplier will maintain insurance coverage and certificates.'),
    ]);
    assert.equal(results.length, 1);
    assert.equal(results[0].id, 'relevant');
    assert.equal(results[0].pageNumber, 8);
  });

  it('retrieves exact clause identifiers and Marathi terms', async () => {
    const results = await RagService.retrieve('clause 7.2 payment', [
      chunk('clause', 4, '7.2 Payment. देय रक्कम तीस दिवसांत भरावी.'),
      chunk('other', 5, 'Confidential information remains protected.'),
    ]);
    assert.equal(results[0]?.id, 'clause');
  });

  it('builds a database filter that always scopes chunks to owner and document', () => {
    assert.deepEqual(authorizedChunkFilter('doc-a', 'user-a'), {
      documentId: 'doc-a', document: { userId: 'user-a' },
    });
  });

  it('rejects cross-user ownership checks including missing identities', () => {
    assert.equal(isResourceOwner('user-a', 'user-a'), true);
    assert.equal(isResourceOwner('user-a', 'user-b'), false);
    assert.equal(isResourceOwner('user-a', ''), false);
  });

  it('keeps page boundaries and overlap when chunking long page-aware text', () => {
    const chunks = PdfService.chunkPages([
      { pageNumber: 3, extractionType: 'paddle_ocr', text: `${'Payment obligations begin on execution. '.repeat(55)}\n\nGoverning law is Maharashtra.` },
      { pageNumber: 4, extractionType: 'selectable', text: '4.1 Termination\n\nEither party may terminate with notice.' },
    ]);
    assert.ok(chunks.length >= 2);
    assert.ok(chunks.every((item) => item.pageNumber === 3 || item.pageNumber === 4));
    assert.ok(chunks.some((item) => item.extractionMethod === 'paddle_ocr'));
    assert.ok(chunks.some((item) => item.pageNumber === 4));
  });
});
import { mock } from 'node:test';
import { validateGroundedAnswer } from './grounded-answer.js';
import { RAG_CHUNK_SIZE } from '../config/index.js';

describe('Source and retrieval regressions', () => {
  const source: RagChunk = { id: 'verified', documentId: 'doc-a', chunkIndex: 0, pageNumber: 9,
    content: '7.2 Payment. The annual fee is INR 240,000 due on 1 April 2026.',
    extractionMethod: 'paddle_ocr', clauseHeading: '7.2 Payment', embedding: null, embeddingModel: null };
  const response = (sources: unknown, answer = 'The annual fee is INR 240,000.') => JSON.stringify({ answer, insufficientEvidence: false, sources });

  it('preserves every word, decimal, clause identifier and Marathi mark in long paragraphs', () => {
    const text = '7.2 Payment: INR 240,000.50 on 1 April 2026. देय रक्कम किती आहे? '.repeat(100);
    const chunks = PdfService.chunkPages([{ pageNumber: 12, text }]);
    assert.ok(chunks.every(c => c.content.length <= RAG_CHUNK_SIZE && text.includes(c.content)));
    const covered = new Set<number>();
    let cursor = 0;
    for (const chunk of chunks) {
      const start = text.indexOf(chunk.content, Math.max(0, cursor - 220));
      assert.ok(start >= 0);
      for (let i = start; i < start + chunk.content.length; i++) covered.add(i);
      cursor = start + chunk.content.length;
    }
    assert.ok([...text].every((char, i) => /\s/.test(char) || covered.has(i)));
  });
  it('never indexes failed-page placeholders or empty pages', () => {
    assert.equal(PdfService.chunkPages([
      { pageNumber: 1, text: 'OCR extraction failed', extractionType: 'failed' },
      { pageNumber: 2, text: '123 --- ...' }, { pageNumber: 3, text: '' },
    ]).length, 0);
  });
  it('keeps Devanagari text even when vowel marks separate every pair of letters', () => {
    const text = 'देय फी देणे';
    const chunks = PdfService.chunkPages([{ pageNumber: 2, text, extractionType: 'verified_user' }]);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].content, text);
  });
  it('derives citation pages from stored sources and carries OCR warnings', () => {
    const result = validateGroundedAnswer(response([{ chunkId: source.id, excerpt: 'INR 240,000' }]), [{ ...source, lowConfidence: true }], 'Agreement.pdf');
    assert.equal(result.citations[0].pageNumber, 9);
    assert.equal(result.citations[0].verified, true);
    assert.match(result.answer, /uncertain OCR/);
  });
  it('rejects invented sources, invented quotations, missing evidence and model page numbers', () => {
    for (const raw of [response([{ chunkId: 'another-document', excerpt: 'INR 240,000' }]),
      response([{ chunkId: source.id, excerpt: 'INR 900,000' }]), response([]),
      response([{ chunkId: source.id, excerpt: 'INR 240,000' }], 'See page 88.'),
      response([{ chunkId: source.id, excerpt: 'INR 240,000' }], 'पान ९९ पहा.')]) {
      assert.throws(() => validateGroundedAnswer(raw, [source], 'Agreement.pdf'));
    }
  });
  it('unsupported answers have no confirmed citations', () => {
    const result = validateGroundedAnswer(JSON.stringify({ answer: 'Invented answer', insufficientEvidence: true,
      sources: [{ chunkId: source.id, excerpt: 'INR 240,000' }] }), [source], 'Agreement.pdf');
    assert.equal(result.isDocumentGrounded, false);
    assert.deepEqual(result.citations, []);
    assert.match(result.answer, /insufficient/);
  });
  it('uses compatible semantic vectors, and ignores malformed or incompatible vectors', async () => {
    const vector = Array.from({ length: 768 }, (_, i) => i === 0 ? 1 : 0);
    const embed = mock.method(RagService, 'embed', async () => vector);
    try {
      const matches = await RagService.retrieve('unrelated synonym', [
        { ...source, embedding: JSON.stringify(vector), embeddingModel: RagService.embeddingModel },
        { ...source, id: 'old', embedding: JSON.stringify(vector), embeddingModel: 'obsolete' },
        { ...source, id: 'broken', embedding: '[1,2]', embeddingModel: RagService.embeddingModel },
      ]);
      assert.deepEqual(matches.map(c => c.id), ['verified']);
      assert.equal(matches[0].semanticMatched, true);
      assert.equal(embed.mock.callCount(), 1);
    } finally { embed.mock.restore(); }
  });
  it('embedding outages degrade to keyword retrieval without fake semantic scores', async () => {
    const embed = mock.method(RagService, 'embed', async () => { throw new Error('offline'); });
    try {
      const matches = await RagService.retrieve('payment', [{ ...source,
        embedding: JSON.stringify(Array(768).fill(1)), embeddingModel: RagService.embeddingModel }]);
      assert.equal(matches[0].semanticMatched, false);
    } finally { embed.mock.restore(); }
  });
  it('retrieves Marathi words with combining marks intact', async () => {
    const results = await RagService.retrieve('देय रक्कम किती आहे?', [{ ...source, content: 'देय रक्कम INR 50,000 आहे.' }]);
    assert.equal(results[0]?.id, source.id);
  });
});
