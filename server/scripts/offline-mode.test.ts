import { it, mock } from 'node:test';
import assert from 'node:assert/strict';
process.env.AI_PROVIDER = 'heuristic';
for (const key of ['GEMINI_API_KEY', 'GROQ_API_KEY', 'LLM_API_KEY', 'OPENAI_API_KEY']) process.env[key] = 'test-configured-but-offline';
const { AIAdapter } = await import('../src/services/ai/ai-adapter.js');
const { RagService } = await import('../src/services/rag.service.js');
it('heuristic mode disables external embeddings and chat even with configured keys', async () => {
  const network = mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected external request'); });
  try {
    assert.equal(AIAdapter.getProviderStatus().activeProvider, 'rule_engine');
    assert.equal(RagService.embeddingEnabled, false);
    assert.equal(await RagService.embed('Synthetic payment clause', 'RETRIEVAL_DOCUMENT'), null);
    const answer = await AIAdapter.answerQuestion('Payment?', [{ id: 'test', chunkIndex: 0, pageNumber: 1, content: 'Payment is INR 500.' }]);
    assert.equal(answer.insufficientEvidence, true);
    assert.deepEqual(answer.citations, []);
    assert.equal(network.mock.callCount(), 0);
  } finally { network.mock.restore(); }
});
