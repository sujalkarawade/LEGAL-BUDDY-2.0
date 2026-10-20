// Runs the existing full API suite with actual routes/DB/extraction and a controlled answer provider.
// No external provider calls. Seeded development accounts/templates are required.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { Server } from 'node:http';
for (const name of ['GEMINI_API_KEY', 'LLM_API_KEY', 'GROQ_API_KEY', 'OPENAI_API_KEY']) process.env[name] = '';
process.env.AI_PROVIDER = 'auto';
const { default: express } = await import('express');
const { default: prisma } = await import('../src/prisma/client.js');
const { AIAdapter } = await import('../src/services/ai/ai-adapter.js');
const { PaddleOcrService } = await import('../src/services/ocr/paddle-ocr.service.js');
const { errorHandler } = await import('../src/middleware/error-handler.js');
const { UPLOAD_DIR, GENERATED_DIR } = await import('../src/config/index.js');
const adapter = AIAdapter as unknown as { geminiClient: unknown };
adapter.geminiClient = { getGenerativeModel: () => ({ generateContent: async (raw: string) => {
  const input = JSON.parse(raw);
  assert.equal(input.documentName, 'sample_nda.pdf');
  assert.equal(input.question, 'What is the notice period for return of materials?');
  const source = input.passages.find((p: any) => p.pageNumber === 2 && /return/i.test(p.text));
  assert.ok(source, 'The real retriever must supply the expected extracted passage.');
  return { response: { text: () => JSON.stringify({ answer: 'The retrieved clause describes the return requirement.',
    insufficientEvidence: false, sources: [{ chunkId: source.chunkId, excerpt: source.text }] }) } };
} }) };
const app = express(); app.use(express.json());
for (const [prefix, module] of [['/api/auth', 'auth'], ['/api/documents', 'document'], ['/api', 'template'], ['/api/dashboard', 'dashboard']]) {
  app.use(prefix, (await import(`../src/routes/${module}.routes.js`)).default);
}
app.use(errorHandler);
const server = await new Promise<Server>(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
process.env.TEST_API_URL = `${origin}/api`;
process.env.TEST_RESULTS_PATH = 'evaluations/last-api-audit-results.json';
process.env.TEST_PROVIDER_MODE = 'controlled-answer-provider; real PostgreSQL, HTTP and PDF/OCR; no external calls';
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
  adapter.geminiClient = null;
  await new Promise<void>(resolve => server.close(() => resolve()));
  PaddleOcrService.shutdown();
  await prisma.document.deleteMany({ where: { id: { in: documents.map(doc => doc.id) } } });
  await prisma.generatedDocument.deleteMany({ where: { id: { in: generated.map(doc => doc.id) } } });
  for (const doc of documents) {
    const file = path.resolve(doc.filePath);
    if (path.dirname(file) === path.resolve(UPLOAD_DIR) && fs.existsSync(file)) fs.unlinkSync(file);
  }
  for (const doc of generated) {
    const file = path.resolve(GENERATED_DIR, doc.docxFileName);
    if (path.dirname(file) === path.resolve(GENERATED_DIR) && fs.existsSync(file)) fs.unlinkSync(file);
  }
  await prisma.$disconnect();
}
