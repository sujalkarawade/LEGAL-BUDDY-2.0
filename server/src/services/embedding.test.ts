import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
process.env.GEMINI_API_KEY = 'unit-test-placeholder';
const { RagService } = await import('./rag.service.js');

describe('Embedding API contract (mocked, no live requests)', () => {
  it('sends document/query tasks and validates 768-dimensional responses', async () => {
    const requests: any[] = [];
    const fetchMock = mock.method(globalThis, 'fetch', async (_url: any, init: any) => {
      requests.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ embedding: { values: Array(768).fill(1) } }));
    });
    try {
      assert.equal((await RagService.embed('payment', 'RETRIEVAL_DOCUMENT'))?.length, 768);
      await RagService.embed('payment?', 'RETRIEVAL_QUERY');
      assert.equal(requests[0].taskType, 'RETRIEVAL_DOCUMENT');
      assert.equal(requests[1].taskType, 'RETRIEVAL_QUERY');
      assert.equal(requests[0].outputDimensionality, 768);
      assert.equal(await RagService.embed('   ', 'RETRIEVAL_DOCUMENT'), null);
      assert.equal(fetchMock.mock.callCount(), 2);
    } finally { fetchMock.mock.restore(); }
  });
  it('retries transient errors but fails immediately for invalid credentials', async () => {
    let attempts = 0;
    const fetchMock = mock.method(globalThis, 'fetch', async () => ++attempts === 1
      ? new Response('', { status: 429 })
      : new Response(JSON.stringify({ embedding: { values: Array(768).fill(1) } })));
    try {
      await RagService.embed('payment', 'RETRIEVAL_DOCUMENT');
      assert.equal(attempts, 2);
    } finally { fetchMock.mock.restore(); }
    const denied = mock.method(globalThis, 'fetch', async () => new Response('', { status: 403 }));
    try {
      await assert.rejects(RagService.embed('payment', 'RETRIEVAL_QUERY'), /403/);
      assert.equal(denied.mock.callCount(), 1);
    } finally { denied.mock.restore(); }
  });
  it('rejects malformed and zero vectors', () => {
    assert.equal(RagService.validVector('[1,2]'), false);
    assert.equal(RagService.validVector(JSON.stringify(Array(768).fill(0))), false);
    assert.equal(RagService.validVector('garbage'), false);
  });
});
