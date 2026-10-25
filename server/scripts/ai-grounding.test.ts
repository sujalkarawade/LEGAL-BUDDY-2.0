import { it, mock } from 'node:test';
import assert from 'node:assert/strict';
process.env.AI_PROVIDER = 'heuristic';
process.env.GROQ_API_KEY = '';
process.env.OPENROUTER_API_KEY = '';
const { AiService } = await import('../src/services/ai/ai-service.js');
const source = { id: 'owned-source', documentId: 'doc-a', ownerId: 'owner', documentName: 'Source.pdf',
  chunkIndex: 0, pageNumber: 7, content: 'Fee: INR 50,000 payable within 30 days.', lowConfidence: true,
  extractionMethod: 'paddle_ocr', ocrReviewFlags: ['flagged'] };
function completion(text: string, inspect?: (messages: any[]) => void) {
  const status = mock.method(AiService, 'getProviderStatus', () => ({ activeProvider: 'groq' as const,
    isLiveLlm: true, groqConfigured: true, openRouterConfigured: false, model: 'test-only' }));
  const generate = mock.method(AiService as any, 'executeCompletion', async (messages: any[]) => {
    inspect?.(messages); return { text, provider: 'test-only', model: 'fixture' };
  });
  return () => { status.mock.restore(); generate.mock.restore(); };
}
it('uses retrieved text, server metadata and OCR warnings without prior answers as evidence', async () => {
  const restore = completion(JSON.stringify({ answer: 'The fee is INR 50,000.', insufficientEvidence: false,
    sources: [{ chunkId: source.id, excerpt: 'INR 50,000' }] }), messages => {
    assert.equal(messages.length, 2);
    assert.ok(!JSON.stringify(messages).includes('PRIVATE PRIOR ANSWER'));
    const passages = JSON.parse(messages[1].content).passages;
    assert.equal(passages[0].uncertainOcr, true);
    assert.deepEqual(passages[0].ocrReviewFlags, ['flagged']);
  });
  try {
    const result = await AiService.answerQuestion('Fee?', [source], [{ role: 'assistant', content: 'PRIVATE PRIOR ANSWER' }], 'Other.pdf');
    assert.equal(result.citations[0].pageNumber, 7);
    assert.equal(result.citations[0].documentId, source.documentId);
    assert.equal(result.citations[0].documentName, 'Source.pdf');
    assert.equal(result.citations[0].verified, true);
    assert.match(result.answer, /uncertain OCR/);
  } finally { restore(); }
});
it('rejects invented excerpts, missing sources, foreign chunks and invented page labels', async () => {
  for (const output of [
    { answer: 'Fee is 900000', sources: [{ chunkId: source.id, excerpt: '900000' }] },
    { answer: 'Fee is 50000', sources: [] },
    { answer: 'Fee is 50000', sources: [{ chunkId: 'foreign', excerpt: 'INR 50,000' }] },
    { answer: 'See page 88.', sources: [{ chunkId: source.id, excerpt: 'INR 50,000' }] },
  ]) {
    const restore = completion(JSON.stringify({ ...output, insufficientEvidence: false }));
    try {
      const result = await AiService.answerQuestion('Fee?', [source]);
      assert.equal(result.insufficientEvidence, true);
      assert.deepEqual(result.citations, []);
    } finally { restore(); }
  }
});
it('does not attach citations when a model abstains despite retrieved neighbors', async () => {
  const restore = completion(JSON.stringify({ answer: 'Not enough information.', insufficientEvidence: true,
    sources: [{ chunkId: source.id, excerpt: 'INR 50,000' }] }));
  try {
    const result = await AiService.answerQuestion('Exclusive jurisdiction?', [source]);
    assert.equal(result.insufficientEvidence, true); assert.deepEqual(result.citations, []);
  } finally { restore(); }
});
it('empty evidence and unavailable generation abstain honestly', async () => {
  for (const chunks of [[], [source]]) {
    const result = await AiService.answerQuestion('Fee?', chunks);
    assert.equal(result.isDocumentGrounded, false);
    assert.equal(result.insufficientEvidence, true);
    assert.deepEqual(result.citations, []);
  }
});
