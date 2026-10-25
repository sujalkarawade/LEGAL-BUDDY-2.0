import { it } from 'node:test';
import assert from 'node:assert/strict';
process.env.AI_PROVIDER = 'heuristic';
process.env.GROQ_API_KEY = '';
process.env.OPENROUTER_API_KEY = '';
const { LocalAnalysisService } = await import('../src/services/local-analysis.service.js');

it('uses the local deterministic analysis path', async () => {
  const result = await LocalAnalysisService.generateSummary('Agreement between buyer and supplier. Payment is due within 30 days.', 'agreement.pdf');
  assert.equal(result.analysisProvider, 'rule_engine');
  const answer = await LocalAnalysisService.answerQuestion('payment due', [{ id: 'chunk', documentId: 'doc', chunkIndex: 0,
    pageNumber: 1, content: 'Payment is due within 30 days.', extractionMethod: 'selectable',
    clauseHeading: 'Payment', lowConfidence: false, score: 1 }]);
  assert.equal(answer.insufficientEvidence, true);
  assert.deepEqual(answer.citations, []);
});
