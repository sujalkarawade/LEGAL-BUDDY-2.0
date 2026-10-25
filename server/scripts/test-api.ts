// Runs the full API suite with real routes/DB/extraction, local rules and controlled synthetic generation.
// No external provider calls. Seeded development accounts/templates are required.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { Server } from 'node:http';
import { mock } from 'node:test';
process.env.AI_PROVIDER = 'heuristic';
process.env.GROQ_API_KEY = '';
process.env.OPENROUTER_API_KEY = '';
process.env.RAG_EMBEDDING_ENABLED = 'false';
const { default: express } = await import('express');
const { default: prisma } = await import('../src/prisma/client.js');
const { PaddleOcrService } = await import('../src/services/ocr/paddle-ocr.service.js');
const { errorHandler } = await import('../src/middleware/error-handler.js');
const { UPLOAD_DIR, GENERATED_DIR } = await import('../src/config/index.js');
const { LocalEmbeddingService } = await import('../src/services/local-embedding.service.js');
const { LocalAnalysisService } = await import('../src/services/local-analysis.service.js');
const { validateGroundedAnswer } = await import('../src/services/grounded-answer.js');
const originalAnswer = LocalAnalysisService.answerQuestion.bind(LocalAnalysisService);
// Test-only generation for the one known synthetic NDA question. Production validation is shared.
const answer = mock.method(LocalAnalysisService, 'answerQuestion', async (question, chunks, history, name) => {
  if (question !== 'What is the notice period for return of materials?') return originalAnswer(question, chunks, history, name);
  const source = chunks.find(c => c.pageNumber === 2 && /return/i.test(c.content));
  assert.ok(source, 'The real retriever must supply the extracted return clause on page 2.');
  return validateGroundedAnswer(JSON.stringify({ answer: 'The retrieved clause describes the return requirement.',
    insufficientEvidence: false, sources: [{ chunkId: source.id, excerpt: source.content }] }), chunks, name!);
});
const app = express(); app.use(express.json());
for (const [prefix, module] of [['/api/auth', 'auth'], ['/api/documents', 'document'], ['/api', 'template'], ['/api/dashboard', 'dashboard']]) {
  app.use(prefix, (await import(`../src/routes/${module}.routes.js`)).default);
}
app.use(errorHandler);
const server = await new Promise<Server>(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
process.env.TEST_API_URL = `${origin}/api`;
process.env.TEST_RESULTS_PATH = 'evaluations/last-hybrid-api-results.json';
process.env.TEST_ANALYSIS_MODE = 'controlled synthetic answer; real PostgreSQL, HTTP, PDF/OCR, keyword retrieval; no external calls';
const originalFetch = globalThis.fetch;
const documents: Array<{ id: string; filePath: string }> = [];
const generated: Array<{ id: string; docxFileName: string }> = [];
globalThis.fetch = async (input, options) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  assert.equal(url.origin, origin, 'External requests are prohibited in the API suite');
  const response = await originalFetch(input, options);
  if (response.ok && options?.method === 'POST' && url.pathname === '/api/documents/upload') {
    const data: any = await response.clone().json(); documents.push(data.document);
  }
  if (response.status === 201 && url.pathname === '/api/document-generator/generate') {
    generated.push((await response.clone().json() as any).generatedDocument);
  }
  return response;
};
try {
  await (await import('./test-e2e.js')).runTests();
} finally {
  globalThis.fetch = originalFetch;
  answer.mock.restore();
  PaddleOcrService.shutdown(); LocalEmbeddingService.shutdown();
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
  try {
    await prisma.document.deleteMany({ where: { id: { in: documents.filter(d => d?.id).map(d => d.id) } } });
    await prisma.generatedDocument.deleteMany({ where: { id: { in: generated.map(d => d.id) } } });
    for (const [root, files] of [[UPLOAD_DIR, documents.map(d => d.filePath)],
      [GENERATED_DIR, generated.map(d => d.docxFileName ? path.join(GENERATED_DIR, d.docxFileName) : '')]] as const) {
      for (const file of files.filter(Boolean)) {
        const resolved = path.resolve(file), relative = path.relative(root, resolved);
        assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'Cleanup must stay in its output directory');
        if (fs.existsSync(resolved)) fs.unlinkSync(resolved);
      }
    }
  } finally { await prisma.$disconnect(); }
}
