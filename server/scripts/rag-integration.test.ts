import { after, before, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import type { Server } from 'node:http';
// Deterministic integration tests never send contract text to a live provider.
for (const name of ['GEMINI_API_KEY', 'LLM_API_KEY', 'GROQ_API_KEY', 'OPENAI_API_KEY']) process.env[name] = '';
process.env.AI_PROVIDER = 'heuristic';
const { default: express } = await import('express');
const { default: jwt } = await import('jsonwebtoken');
const { default: prisma } = await import('../src/prisma/client.js');
const { default: routes } = await import('../src/routes/document.routes.js');
const { JWT_SECRET } = await import('../src/config/index.js');
const { RagService, authorizedChunkFilter } = await import('../src/services/rag.service.js');
const { AIAdapter } = await import('../src/services/ai/ai-adapter.js');
const { DocumentController } = await import('../src/controllers/document.controller.js');
const { JobQueueService } = await import('../src/services/job-queue.service.js');
const { validateGroundedAnswer } = await import('../src/services/grounded-answer.js');
const { errorHandler } = await import('../src/middleware/error-handler.js');
const userA = randomUUID(), userB = randomUUID();
const docA = randomUUID(), docB = randomUUID();
let base: string, server: Server, clauseB: string, checkB: string, obligationB: string, uploadedId: string;
const filePaths: string[] = [];
const token = (id: string) => jwt.sign({ id }, JWT_SECRET);
async function request(route: string, user: string | null = userA, method = 'GET', body?: unknown) {
  return fetch(`${base}${route}`, { method, headers: { ...(user ? { Authorization: `Bearer ${token(user)}` } : {}),
    ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }) },
    body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body) });
}
async function waitJob(id: string) {
  for (let i = 0; i < 200; i++) {
    const job = JobQueueService.getJob(id)!;
    if (job.status === 'FAILED' || job.status === 'COMPLETED') return job;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error('Job timed out');
}
before(async () => {
  await prisma.user.createMany({ data: [userA, userB].map(id => ({ id, email: `rag-${id}@example.invalid`, name: 'RAG Test', passwordHash: 'not-a-login' })) });
  for (const [id, userId] of [[docA, userA], [docB, userB]]) {
    await prisma.document.create({ data: { id, userId, originalName: 'Test.pdf', storedName: `${id}.pdf`,
      filePath: 'not-a-real-file', fileSize: 0, mimeType: 'application/pdf', status: 'COMPLETED', ragStatus: 'KEYWORD_READY', pageCount: 1,
      chunks: { create: { chunkIndex: 0, pageNumber: 1, content: userId === userA ? '7.2 Payment is INR 500.' : 'SECRET USER B: Payment is INR 900000.' } } } });
  }
  clauseB = (await prisma.clauseFinding.create({ data: { documentId: docB, category: 'Payment', title: 'Private', excerpt: 'Secret', plainLanguageExplanation: 'Private', riskLevel: 'Low' } })).id;
  checkB = (await prisma.completenessCheck.create({ data: { documentId: docB, expectedSection: 'Secret', status: 'FOUND', reason: 'Private' } })).id;
  obligationB = (await prisma.extractedObligation.create({ data: { documentId: docB, category: 'Payment', description: 'Secret' } })).id;
  const app = express(); app.use(express.json()); app.use('/documents', routes); app.use(errorHandler);
  server = await new Promise<Server>(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/documents`;
});
after(async () => {
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
  for (const file of filePaths) if (fs.existsSync(file)) fs.unlinkSync(file);
  await prisma.$disconnect();
});
it('requires authentication and rejects malformed document IDs', async () => {
  assert.equal((await request(`/${docA}/chat`, null)).status, 401);
  assert.equal((await request('/invalid-id/chat')).status, 400);
});
it('denies another user across document, chat, extraction and download routes', async () => {
  for (const suffix of ['', '/chat', '/ocr-preview', '/download', '/summary', '/clauses', '/obligations', '/completeness']) {
    assert.equal((await request(`/${docB}${suffix}`)).status, 404, suffix);
  }
  assert.equal((await request(`/${docB}/chat`, userA, 'POST', { question: 'Show private payment' })).status, 404);
  assert.equal((await request(`/${docB}/ocr-preview/re-ocr`, userA, 'POST', {})).status, 404);
});
it('scopes actual database retrieval by both owner and document', async () => {
  assert.deepEqual(await prisma.documentChunk.findMany({ where: authorizedChunkFilter(docB, userA) }), []);
  const chunks = await prisma.documentChunk.findMany({ where: authorizedChunkFilter(docA, userA) });
  assert.equal(chunks.length, 1); assert.ok(!chunks[0].content.includes('SECRET'));
});
it('blocks nested review IDs from another document', async () => {
  for (const [suffix, body] of [[`clauses/${clauseB}`, { reviewStatus: 'APPROVED' }],
    [`completeness/${checkB}`, { isReviewed: true }], [`obligations/${obligationB}`, { reviewStatus: 'ACKNOWLEDGED' }]] as const) {
    assert.notEqual((await request(`/${docA}/${suffix}`, userA, 'PATCH', body)).status, 200);
  }
  assert.equal((await prisma.clauseFinding.findUniqueOrThrow({ where: { id: clauseB } })).reviewStatus, 'PENDING');
  assert.equal((await prisma.completenessCheck.findUniqueOrThrow({ where: { id: checkB } })).isReviewed, false);
  assert.equal((await prisma.extractedObligation.findUniqueOrThrow({ where: { id: obligationB } })).reviewStatus, 'UNREVIEWED');
});
it('protects background job metadata from other users', async () => {
  const job = JobQueueService.createJob(docB, userB);
  assert.equal((await request(`/jobs/${job.id}`)).status, 404);
});
it('passes only authorized retrieved passages into answer generation and saves verified citations', async () => {
  const answer = mock.method(AIAdapter, 'answerQuestion', async (_question, chunks, _history, name) => {
    assert.ok(chunks.every(c => !c.content.includes('SECRET')));
    return validateGroundedAnswer(JSON.stringify({ answer: 'Payment is INR 500.', insufficientEvidence: false,
      sources: [{ chunkId: chunks[0].id, excerpt: 'INR 500' }] }), chunks, name!);
  });
  try {
    const res = await request(`/${docA}/chat`, userA, 'POST', { question: 'Payment amount?' });
    assert.equal(res.status, 200);
    const data: any = await res.json();
    assert.equal(data.citations[0].pageNumber, 1);
    assert.equal(data.citations[0].verified, true);
    assert.ok(data.metrics.totalResponseTimeMs >= 0);
    assert.equal((await prisma.chatMessage.count({ where: { conversation: { documentId: docB } } })), 0);
  } finally { answer.mock.restore(); }
});
it('honestly handles absent evidence without invoking a model', async () => {
  const res = await request(`/${docA}/chat`, userA, 'POST', { question: 'Exclusive jurisdiction court?' });
  const data: any = await res.json();
  assert.equal(data.insufficientEvidence, true); assert.deepEqual(data.citations, []);
});
it('processes a real selectable PDF asynchronously and preserves analysis features', async () => {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync('sample_contracts/sample_nda.pdf')], { type: 'application/pdf' }), 'rag-test-nda.pdf');
  const res = await request('/upload', userA, 'POST', form);
  assert.equal(res.status, 202);
  const data: any = await res.json(); uploadedId = data.documentId; filePaths.push(data.document.filePath);
  assert.equal((await waitJob(data.jobId)).status, 'COMPLETED');
  const doc = await prisma.document.findUniqueOrThrow({ where: { id: uploadedId }, include: { summary: true, chunks: true, clauses: true, completenessChecks: true, obligations: true } });
  assert.equal(doc.ragStatus, 'KEYWORD_READY'); assert.equal(doc.pageCount, 2);
  assert.ok(doc.summary && doc.chunks.length && doc.clauses.length && doc.completenessChecks.length && doc.obligations.length);
  assert.ok(doc.chunks.every(c => c.pageNumber >= 1 && c.pageNumber <= 2));
});
it('retrieves and cites the actual extracted NDA payment-cap passage on page 2', async () => {
  const answer = mock.method(AIAdapter, 'answerQuestion', async (_question, chunks, _history, name) => {
    const source = chunks.find(c => c.pageNumber === 2 && c.content.includes('$50,000'));
    assert.ok(source, 'Actual extracted source must be retrieved');
    return validateGroundedAnswer(JSON.stringify({ answer: 'The cap is $50,000.', insufficientEvidence: false,
      sources: [{ chunkId: source.id, excerpt: '$50,000' }] }), chunks, name!);
  });
  try {
    const response = await request(`/${uploadedId}/chat`, userA, 'POST', { question: 'What is the liability cap?' });
    assert.equal(response.status, 200);
    const data: any = await response.json();
    const source = await prisma.documentChunk.findUniqueOrThrow({ where: { id: data.citations[0].chunkId } });
    assert.equal(source.documentId, uploadedId);
    assert.equal(data.citations[0].pageNumber, source.pageNumber);
    assert.ok(source.content.includes(data.citations[0].excerpt));
  } finally { answer.mock.restore(); }
});
it('propagates uncertain page metadata to generation and citations', async () => {
  await prisma.document.update({ where: { id: docA }, data: { ocrMetadata: JSON.stringify({ pages: [{ pageNumber: 1, flagged: true, hasLowConfidence: true }] }) } });
  const answer = mock.method(AIAdapter, 'answerQuestion', async (_question, chunks, _history, name) => {
    assert.ok(chunks[0].lowConfidence);
    return validateGroundedAnswer(JSON.stringify({ answer: 'Payment is INR 500.', insufficientEvidence: false,
      sources: [{ chunkId: chunks[0].id, excerpt: 'INR 500' }] }), chunks, name!);
  });
  try {
    const data: any = await (await request(`/${docA}/chat`, userA, 'POST', { question: 'Payment amount?' })).json();
    assert.equal(data.citations[0].lowConfidence, true);
    assert.match(data.message.content, /uncertain OCR/);
  } finally { answer.mock.restore(); }
});
it('reuses unchanged chunks and preserves untargeted pages on verification', async () => {
  const clause = await prisma.clauseFinding.findFirstOrThrow({ where: { documentId: uploadedId } });
  const check = await prisma.completenessCheck.findFirstOrThrow({ where: { documentId: uploadedId } });
  const obligation = await prisma.extractedObligation.findFirstOrThrow({ where: { documentId: uploadedId } });
  await prisma.clauseFinding.update({ where: { id: clause.id }, data: { reviewStatus: 'APPROVED' } });
  await prisma.completenessCheck.update({ where: { id: check.id }, data: { isReviewed: true } });
  await prisma.extractedObligation.update({ where: { id: obligation.id }, data: { reviewStatus: 'ACKNOWLEDGED' } });
  const before = await prisma.documentChunk.findMany({ where: { documentId: uploadedId }, orderBy: { chunkIndex: 'asc' } });
  const retry: any = await (await request(`/${uploadedId}/ocr-preview/re-ocr`, userA, 'POST', {})).json();
  assert.equal((await waitJob(retry.jobId)).status, 'COMPLETED');
  const after = await prisma.documentChunk.findMany({ where: { documentId: uploadedId }, orderBy: { chunkIndex: 'asc' } });
  assert.deepEqual(after.map(c => c.id), before.map(c => c.id));
  assert.equal((await prisma.clauseFinding.findUnique({ where: { id: clause.id } }))?.reviewStatus, 'APPROVED');
  assert.equal((await prisma.completenessCheck.findUnique({ where: { id: check.id } }))?.isReviewed, true);
  assert.equal((await prisma.extractedObligation.findUnique({ where: { id: obligation.id } }))?.reviewStatus, 'ACKNOWLEDGED');
  const verified = await request(`/${uploadedId}/ocr-preview/verify`, userA, 'POST', { pages: [{ pageNumber: 1, text: '1. Payment. Verified fee is INR 123.' }] });
  assert.equal(verified.status, 202);
  const job: any = await verified.json(); assert.equal((await waitJob(job.jobId)).status, 'COMPLETED');
  const pages = JSON.parse((await prisma.document.findUniqueOrThrow({ where: { id: uploadedId } })).ocrMetadata!).pages;
  assert.equal(pages.length, 2); assert.equal(pages[0].extractionType, 'verified_user'); assert.ok(pages[1].text.length > 0);
});
it('rejects malformed retry and verification payloads', async () => {
  for (const body of [{ pageNumbers: 'all' }, { pageNumbers: [999] }, { pageNumbers: [1, 1] }, { bypassCache: 'yes' }]) {
    assert.equal((await request(`/${uploadedId}/ocr-preview/re-ocr`, userA, 'POST', body)).status, 400);
  }
  for (const pages of [[null], [{ pageNumber: 1, text: 123 }], [{ pageNumber: 99, text: 'foo' }]]) {
    assert.equal((await request(`/${uploadedId}/ocr-preview/verify`, userA, 'POST', { pages })).status, 400);
  }
});
it('redacts extraction exceptions in sync responses, jobs, stored errors and logs', async () => {
  const { PdfService } = await import('../src/services/pdf-service.js');
  const secret = 'SYNTHETIC-CONFIDENTIAL-SENTINEL';
  const extract = mock.method(PdfService, 'extractText', async () => { throw new Error(secret); });
  const log = mock.method(console, 'error', () => {});
  try {
    const response = await request(`/${uploadedId}/ocr-preview/re-ocr?sync=true`, userA, 'POST', {});
    assert.equal(response.status, 500);
    assert.ok(!(await response.text()).includes(secret));
    const job = JobQueueService.getJobByDocumentId(uploadedId)!;
    assert.equal(job.status, 'FAILED'); assert.ok(!JSON.stringify(job).includes(secret));
    const stored = await prisma.document.findUniqueOrThrow({ where: { id: uploadedId } });
    assert.ok(!stored.errorMessage?.includes(secret));
    assert.ok(!JSON.stringify(log.mock.calls).includes(secret));
  } finally { extract.mock.restore(); log.mock.restore(); }
});
it('embedding failure prevents readiness and retry reuses completed embedding work', async () => {
  const doc = await prisma.document.findUniqueOrThrow({ where: { id: uploadedId } });
  const meta = JSON.parse(doc.ocrMetadata!);
  const { PdfService } = await import('../src/services/pdf-service.js');
  const extraction = { text: doc.extractedText!, pageCount: doc.pageCount, chunks: PdfService.chunkPages(meta.pages), isScannedOrEmpty: false, ocrResult: meta };
  const enabled = mock.method(RagService, 'embeddingEnabled', () => true, { getter: true });
  let calls = 0, fail = true;
  const embed = mock.method(RagService, 'embed', async () => { calls++; if (fail && calls === 2) throw new Error('Transient test failure'); return Array(768).fill(1); });
  try {
    await assert.rejects(DocumentController.processDocumentAsync(uploadedId, doc.filePath, doc.originalName, undefined, { extraction }));
    assert.equal((await prisma.document.findUniqueOrThrow({ where: { id: uploadedId } })).ragStatus, 'FAILED');
    assert.equal((await request(`/${uploadedId}/chat`, userA, 'POST', { question: 'payment' })).status, 409);
    fail = false;
    const completed = await DocumentController.processDocumentAsync(uploadedId, doc.filePath, doc.originalName, undefined, { extraction });
    assert.equal(completed.document.ragStatus, 'READY');
    assert.equal(calls, extraction.chunks.length + 1); // Failed call retried, successful first chunk reused.
  } finally { embed.mock.restore(); enabled.mock.restore(); }
});
it('a missing OCR page keeps the whole document out of ready state', async () => {
  const conversation = await prisma.chatConversation.create({ data: { documentId: uploadedId, userId: userA } });
  const oldSource = await prisma.documentChunk.findFirstOrThrow({ where: { documentId: uploadedId, pageNumber: 2 } });
  await prisma.chatMessage.create({ data: { conversationId: conversation.id, role: 'assistant', content: 'Old answer',
    sourceCitations: JSON.stringify([{ verified: true, chunkId: oldSource.id, excerpt: oldSource.content, pageNumber: 2 }]) } });
  const doc = await prisma.document.findUniqueOrThrow({ where: { id: uploadedId } });
  const meta = JSON.parse(doc.ocrMetadata!); meta.pages[1] = { ...meta.pages[1], text: '', extractionType: 'failed' };
  const { PdfService } = await import('../src/services/pdf-service.js');
  const result = await DocumentController.processDocumentAsync(uploadedId, doc.filePath, doc.originalName, undefined,
    { extraction: { text: meta.pages[0].text, pageCount: 2, chunks: PdfService.chunkPages(meta.pages), isScannedOrEmpty: false, ocrResult: meta } });
  assert.equal(result.document.ragStatus, 'REVIEW_REQUIRED');
  assert.equal((await request(`/${uploadedId}/chat`, userA, 'POST', { question: 'Payment' })).status, 409);
  const history: any = await (await request(`/${uploadedId}/chat`)).json();
  assert.ok(history.conversation.messages.every((m: any) => !m.sourceCitations || JSON.parse(m.sourceCitations).length === 0));
});
it('no chunks can never produce a ready document, even if an extraction flag is inconsistent', async () => {
  const doc = await prisma.document.findUniqueOrThrow({ where: { id: uploadedId } });
  const meta = JSON.parse(doc.ocrMetadata!);
  meta.pages = meta.pages.map((p: any) => ({ ...p, text: '', extractionType: 'verified_user' }));
  const result = await DocumentController.processDocumentAsync(uploadedId, doc.filePath, doc.originalName, undefined,
    { extraction: { text: '', pageCount: 2, chunks: [], isScannedOrEmpty: false, ocrResult: meta } });
  assert.equal(result.document.ragStatus, 'REVIEW_REQUIRED');
  assert.equal((await request(`/${uploadedId}/chat`, userA, 'POST', { question: 'Payment' })).status, 409);
});
it('rejects stale embedding models before answering', async () => {
  const enabled = mock.method(RagService, 'embeddingEnabled', () => true, { getter: true });
  try {
    const response = await request(`/${docA}/chat`, userA, 'POST', { question: 'Payment?' });
    assert.equal(response.status, 409);
    assert.match((await response.json() as any).error, /rebuilding/);
  } finally { enabled.mock.restore(); }
});
it('does not save an answer if the document changes during generation', async () => {
  const beforeCount = await prisma.chatMessage.count({ where: { conversation: { documentId: docA }, role: 'assistant' } });
  const answer = mock.method(AIAdapter, 'answerQuestion', async (_question, chunks, _history, name) => {
    await prisma.document.update({ where: { id: docA }, data: { status: 'PROCESSING', ragStatus: 'INDEXING' } });
    return validateGroundedAnswer(JSON.stringify({ answer: 'Payment is INR 500.', insufficientEvidence: false,
      sources: [{ chunkId: chunks[0].id, excerpt: 'INR 500' }] }), chunks, name!);
  });
  try {
    const response = await request(`/${docA}/chat`, userA, 'POST', { question: 'Payment?' });
    assert.equal(response.status, 409);
    assert.equal(await prisma.chatMessage.count({ where: { conversation: { documentId: docA }, role: 'assistant' } }), beforeCount);
  } finally { answer.mock.restore(); }
});
