import { it } from 'node:test';
import assert from 'node:assert/strict';
for (const key of ['GEMINI_API_KEY', 'GROQ_API_KEY', 'LLM_API_KEY', 'OPENAI_API_KEY']) process.env[key] = '';
const { AIAdapter } = await import('../src/services/ai/ai-adapter.js');
const adapter = AIAdapter as unknown as { geminiClient: unknown };
const source = { id: 'owned-source', chunkIndex: 0, pageNumber: 7, content: 'Fee: INR 50,000 payable within 30 days.', lowConfidence: true };
it('Gemini receives only retrieved evidence and ignores previous generated answers as evidence', async () => {
  let prompt = '', system = '';
  adapter.geminiClient = { getGenerativeModel: (options: any) => {
    system = options.systemInstruction;
    return { generateContent: async (value: string) => {
      prompt = value;
      return { response: { text: () => JSON.stringify({ answer: 'The fee is INR 50,000.', insufficientEvidence: false,
        sources: [{ chunkId: source.id, excerpt: 'INR 50,000' }] }) } };
    } };
  } };
  try {
    const result = await AIAdapter.answerQuestion('Fee?', [source], [{ role: 'assistant', content: 'PRIVATE PRIOR ANSWER' }], 'Sample.pdf');
    assert.equal(result.provider, 'gemini'); assert.equal(result.citations[0].pageNumber, 7);
    assert.match(result.answer, /uncertain OCR/);
    assert.ok(!prompt.includes('PRIVATE PRIOR ANSWER'));
    assert.equal(JSON.parse(prompt).passages.length, 1);
    assert.equal(JSON.parse(prompt).passages[0].uncertainOcr, true);
    assert.match(system, /untrusted/); assert.match(system, /conflicting/); assert.match(system, /insufficient/);
  } finally { adapter.geminiClient = null; }
});
it('malformed or fabricated Gemini sources fail closed without confirmed citations', async () => {
  adapter.geminiClient = { getGenerativeModel: () => ({ generateContent: async () => ({ response: {
    text: () => JSON.stringify({ answer: 'The fee is INR 900,000.', insufficientEvidence: false,
      sources: [{ chunkId: 'another-document', excerpt: 'INR 900,000' }] }),
  } }) }) };
  try {
    const result = await AIAdapter.answerQuestion('Fee?', [source]);
    assert.equal(result.insufficientEvidence, true); assert.deepEqual(result.citations, []);
  } finally { adapter.geminiClient = null; }
});
it('provider failures and empty retrieval produce explicit uncertainty', async () => {
  adapter.geminiClient = { getGenerativeModel: () => { throw new Error('offline'); } };
  try {
    const failed = await AIAdapter.answerQuestion('Fee?', [source]);
    const absent = await AIAdapter.answerQuestion('Fee?', []);
    assert.equal(failed.isDocumentGrounded, false); assert.equal(absent.isDocumentGrounded, false);
    assert.equal(failed.insufficientEvidence, true); assert.equal(absent.insufficientEvidence, true);
  } finally { adapter.geminiClient = null; }
});

it('reports provider credit exhaustion explicitly without presenting it as an evidence failure', async () => {
  adapter.geminiClient = { getGenerativeModel: () => { throw Object.assign(new Error('provider denied'), { status: 402 }); } };
  try {
    const result = await AIAdapter.answerQuestion('Fee?', [source]);
    assert.match(result.answer, /insufficient credit/);
    assert.equal(result.insufficientEvidence, true);
    assert.deepEqual(result.citations, []);
  } finally { adapter.geminiClient = null; }
});
