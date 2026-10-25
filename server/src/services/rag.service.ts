import { z } from 'zod';
import prisma from '../prisma/client.js';
import {
  RAG_RETRIEVAL_LIMIT, RAG_CANDIDATE_LIMIT, RAG_RRF_K, RAG_SEARCH_MODE,
  RAG_RERANK_ENABLED, RAG_RERANK_TIMEOUT_MS, RAG_SEARCH_TIMEOUT_MS, RAG_MAX_CHUNKS, RAG_LOG_METRICS,
} from '../config/index.js';
import { LocalEmbeddingService, validVector } from './local-embedding.service.js';

export interface RagChunk {
  id: string; documentId: string; chunkIndex: number; pageNumber: number; content: string;
  extractionMethod: string; clauseHeading: string | null;
  embedding?: string | null; embeddingModel?: string | null;
  ownerId?: string; documentName?: string; lowConfidence?: boolean; ocrReviewFlags?: string[];
}
export interface RetrievedChunk extends RagChunk {
  score: number; lowConfidence: boolean; lexicalScore: number;
  semanticScore: number | null; semanticMatched: boolean; rerankScore?: number;
}
export type SearchMode = 'keyword' | 'semantic' | 'hybrid';
export interface RetrievalOptions { mode?: SearchMode; rerank?: boolean; limit?: number; candidateLimit?: number }
export interface RankingOptions extends RetrievalOptions { queryVector?: number[] | null; signature?: string }
export interface SearchStats {
  mode: 'semantic_hybrid' | 'semantic' | 'keyword_fallback';
  semanticStatus: 'available' | 'partial' | 'disabled' | 'unavailable' | 'incompatible' | 'not_requested';
  rerankApplied: boolean; rerankTimedOut: boolean; lexicalCandidates: number; semanticCandidates: number;
  candidateCount: number; returnedCount: number; embeddingMs: number; rankingMs: number; rerankMs: number; totalMs: number;
}
export interface SearchResult { chunks: RetrievedChunk[]; stats: SearchStats }
export class RetrievalError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function authorizedChunkFilter(documentId: string | string[], userId: string) {
  if (!userId || !documentId || (Array.isArray(documentId) && !documentId.length)) throw new RetrievalError(400, 'A document and authenticated owner are required.');
  return { documentId: Array.isArray(documentId) ? { in: documentId } : documentId, document: { userId } };
}
const stop = new Set(('the and for with from that this what when where which who does are was were has have is of in to a an it say contract agreement how much long can could should would shall do about please tell me under on as be by or at its us our your').split(' '));
for (const term of ['काय', 'आहे', 'किती', 'करारात', 'कधी', 'कसे']) stop.add(term);
export function normalizeLegalText(text: string): string {
  return text.normalize('NFC').toLowerCase().replace(/[०-९]/g, c => String(c.charCodeAt(0) - 0x0966))
    .replace(/(\d),(?=\d{3}(?:\D|$))/g, '$1').replace(/\s+/g, ' ').trim();
}
export function legalTerms(text: string): string[] {
  return (normalizeLegalText(text).match(/[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:[./-][\p{L}\p{M}\p{N}]+)*/gu) || [])
    .filter(term => !stop.has(term)).map(term => /^[a-z]{4,}s$/.test(term) && !term.endsWith('ss') ? term.slice(0, -1) : term);
}
function vector(value: string | null | undefined, dimensions: number): number[] | null {
  try { const parsed = value ? JSON.parse(value) : null; return validVector(parsed, dimensions) ? parsed : null; } catch { return null; }
}
function cosine(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; normA += a[i] ** 2; normB += b[i] ** 2; }
  return Math.max(-1, Math.min(1, dot / Math.sqrt(normA * normB)));
}
function stable(a: RagChunk, b: RagChunk): number {
  return a.documentId.localeCompare(b.documentId) || a.chunkIndex - b.chunkIndex || a.id.localeCompare(b.id);
}
export async function retrievalTimeout<T>(work: Promise<T>, ms = RAG_SEARCH_TIMEOUT_MS): Promise<T> {
  let timer: NodeJS.Timeout;
  try {
    return await Promise.race([work, new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new RetrievalError(503, 'Retrieval timed out. Please retry.')), ms);
    })]);
  } finally { clearTimeout(timer!); }
}

/** One retrieval pipeline. Production callers must enter through searchAuthorized. */
export class RagService {
  static rank(question: string, input: RagChunk[], options: RankingOptions = {}): SearchResult {
    const started = performance.now();
    const mode = options.mode || RAG_SEARCH_MODE as SearchMode;
    const limit = Math.max(1, Math.min(10, options.limit ?? RAG_RETRIEVAL_LIMIT));
    const count = Math.max(limit, Math.min(100, options.candidateLimit ?? RAG_CANDIDATE_LIMIT));
    const chunks = [...new Map(input.filter(c => c.content.trim() && c.extractionMethod !== 'failed' && Number.isInteger(c.pageNumber) && c.pageNumber > 0).map(c => [c.id, c])).values()];
    const query = [...new Set(legalTerms(question))];
    const tokens = chunks.map(c => legalTerms(c.content));
    const headings = chunks.map(c => new Set(legalTerms(c.clauseHeading || '')));
    const df = new Map<string, number>();
    for (const terms of tokens) for (const term of new Set(terms)) df.set(term, (df.get(term) || 0) + 1);
    const avgLength = tokens.reduce((sum, t) => sum + t.length, 0) / Math.max(1, chunks.length) || 1;
    const clause = normalizeLegalText(question).match(/(?:clause|section|article|कलम)\s+(\d+(?:\.\d+)*)/u)?.[1];
    const queryVector = options.queryVector;
    const usableQuery = Boolean(queryVector && options.signature && validVector(queryVector, queryVector.length));
    const scored: RetrievedChunk[] = chunks.map((chunk, i) => {
      if ((i & 255) === 0 && performance.now() - started > RAG_SEARCH_TIMEOUT_MS) throw new RetrievalError(503, 'Retrieval timed out. Please retry.');
      const tf = new Map<string, number>();
      for (const term of tokens[i]) tf.set(term, (tf.get(term) || 0) + 1);
      let lexicalScore = 0;
      for (const term of query) {
        const frequency = tf.get(term) || 0;
        const idf = Math.log(1 + (chunks.length - (df.get(term) || 0) + 0.5) / ((df.get(term) || 0) + 0.5));
        if (frequency) lexicalScore += idf * frequency * 2.2 / (frequency + 1.2 * (0.25 + 0.75 * tokens[i].length / avgLength));
        if (headings[i].has(term)) lexicalScore += 0.5 * idf;
      }
      if (clause && (tf.has(clause) || headings[i].has(clause))) lexicalScore += 8;
      const embedded = usableQuery && chunk.embeddingModel === options.signature ? vector(chunk.embedding, queryVector!.length) : null;
      return { ...chunk, score: 0, lowConfidence: chunk.lowConfidence || false, lexicalScore,
        semanticScore: embedded ? cosine(queryVector!, embedded) : null, semanticMatched: Boolean(embedded) };
    });
    // No unvalidated cosine relevance threshold: answer generation must select evidence or abstain.
    const lexical = mode === 'semantic' ? [] : scored.filter(c => c.lexicalScore > 0).sort((a,b) => b.lexicalScore - a.lexicalScore || stable(a,b)).slice(0, count);
    const semantic = mode === 'keyword' || !query.length ? [] : scored.filter(c => c.semanticMatched).sort((a,b) => b.semanticScore! - a.semanticScore! || stable(a,b)).slice(0, count);
    for (const lane of [lexical, semantic]) for (const [i, chunk] of lane.entries()) chunk.score += 1 / (RAG_RRF_K + i + 1);
    let candidates = scored.filter(c => c.score > 0).sort((a,b) => b.score - a.score || stable(a,b)).slice(0, count);
    const rankingMs = performance.now() - started;
    let rerankApplied = false, rerankTimedOut = false;
    const rerankStarted = performance.now();
    if ((options.rerank ?? RAG_RERANK_ENABLED) && candidates.length > 1) {
      try {
        const reranked = candidates.map(chunk => {
          if (performance.now() - rerankStarted > RAG_RERANK_TIMEOUT_MS) throw new Error('rerank_budget');
          const terms = legalTerms(chunk.content), set = new Set(terms), heading = new Set(legalTerms(chunk.clauseHeading || ''));
          const coverage = query.filter(t => set.has(t)).length / Math.max(1, query.length);
          const headingCoverage = query.filter(t => heading.has(t)).length / Math.max(1, query.length);
          const normalized = ' ' + terms.join(' ') + ' ';
          let phrases = 0;
          for (let i = 0; i < query.length - 1; i++) if (normalized.includes(' ' + query[i] + ' ' + query[i + 1] + ' ')) phrases++;
          const phraseCoverage = phrases / Math.max(1, query.length - 1);
          const quoted = [...normalizeLegalText(question).matchAll(/"([^"\n]{2,120})"/g)].map(m => m[1]);
          const quoteMatch = quoted.some(q => normalizeLegalText(chunk.content).includes(q)) ? 1 : 0;
          const anchor = clause ? (set.has(clause) || heading.has(clause) ? 2 : -1) : 0;
          // Lightweight feature reranker, not a learned cross-encoder. Never display this as confidence.
          const rerankScore = chunk.score * (RAG_RRF_K + 1) + 0.6 * coverage + 0.4 * headingCoverage + 0.5 * phraseCoverage + quoteMatch + anchor;
          return { ...chunk, rerankScore };
        });
        candidates = reranked.sort((a,b) => b.rerankScore - a.rerankScore || b.score - a.score || stable(a,b));
        rerankApplied = true;
      } catch { rerankTimedOut = true; }
    }
    const result = candidates.slice(0, limit);
    return { chunks: result, stats: {
      mode: semantic.length ? (mode === 'semantic' ? 'semantic' : 'semantic_hybrid') : 'keyword_fallback',
      semanticStatus: usableQuery ? 'available' : 'disabled', rerankApplied, rerankTimedOut,
      lexicalCandidates: lexical.length, semanticCandidates: semantic.length, candidateCount: candidates.length,
      returnedCount: result.length, embeddingMs: 0, rankingMs, rerankMs: performance.now() - rerankStarted, totalMs: performance.now() - started,
    } };
  }

  static async search(question: string, chunks: RagChunk[], options: RetrievalOptions = {}): Promise<SearchResult> {
    const started = performance.now();
    const mode = options.mode || RAG_SEARCH_MODE as SearchMode;
    let queryVector: number[] | null = null, signature: string | undefined;
    let status: SearchStats['semanticStatus'] = mode === 'keyword' ? 'not_requested' : LocalEmbeddingService.enabled ? 'incompatible' : 'disabled';
    const embeddingStarted = performance.now();
    const remaining = () => Math.max(1, RAG_SEARCH_TIMEOUT_MS - (performance.now() - started));
    if (mode !== 'keyword' && LocalEmbeddingService.enabled && chunks.length && legalTerms(question).length && chunks.some(c => c.embedding && c.embeddingModel)) {
      try {
        const info = await retrievalTimeout(LocalEmbeddingService.getInfo(), remaining());
        const compatible = info ? chunks.filter(c => c.embeddingModel === info.signature && vector(c.embedding, info.dimensions)).length : 0;
        if (info && compatible) {
          signature = info.signature;
          [queryVector] = await retrievalTimeout(LocalEmbeddingService.embed([question], 'query'), remaining());
          status = compatible === chunks.length ? 'available' : 'partial';
        } else status = 'incompatible';
      } catch { status = 'unavailable'; console.warn('[RAG] Local query embeddings unavailable; using keyword retrieval.'); }
    }
    const embeddingMs = performance.now() - embeddingStarted;
    const result = this.rank(question, chunks, { ...options, mode: queryVector ? mode : 'keyword', queryVector, signature });
    result.stats = { ...result.stats, semanticStatus: status, embeddingMs, totalMs: performance.now() - started };
    if (RAG_LOG_METRICS) console.info(JSON.stringify({ event: 'rag_retrieval', ...result.stats }));
    return result;
  }

  /** Backwards-compatible entry point for source rows that the caller has already authorized. */
  static async retrieve(question: string, chunks: RagChunk[], limit = RAG_RETRIEVAL_LIMIT, options: RetrievalOptions = {}): Promise<RetrievedChunk[]> {
    return (await this.search(question, chunks, { ...options, limit })).chunks;
  }

  static async searchAuthorized(question: string, scope: { userId: string; documentIds: string[] }, options: RetrievalOptions = {}): Promise<SearchResult> {
    if (!z.string().uuid().safeParse(scope.userId).success || !z.array(z.string().uuid()).min(1).max(20).safeParse(scope.documentIds).success ||
      new Set(scope.documentIds).size !== scope.documentIds.length || !question.trim() || question.length > 2000) throw new RetrievalError(400, 'Invalid retrieval scope or question.');
    const started = performance.now();
    const remaining = () => {
      const ms = RAG_SEARCH_TIMEOUT_MS - (performance.now() - started);
      if (ms <= 0) throw new RetrievalError(503, 'Retrieval timed out. Please retry.');
      return ms;
    };
    const documents = await retrievalTimeout(prisma.document.findMany({ where: { id: { in: scope.documentIds }, userId: scope.userId },
      select: { id: true, userId: true, originalName: true, ocrMetadata: true, status: true, ragStatus: true } }), remaining());
    if (documents.length !== scope.documentIds.length) throw new RetrievalError(404, 'Document not found.');
    if (documents.some(d => d.status !== 'COMPLETED' || !['READY', 'KEYWORD_READY'].includes(d.ragStatus))) throw new RetrievalError(409, 'Selected documents are not ready for retrieval.');
    const rows = await retrievalTimeout(prisma.documentChunk.findMany({ where: { ...authorizedChunkFilter(scope.documentIds, scope.userId),
      document: { userId: scope.userId, status: 'COMPLETED', ragStatus: { in: ['READY', 'KEYWORD_READY'] } } },
      orderBy: [{ documentId: 'asc' }, { chunkIndex: 'asc' }], take: RAG_MAX_CHUNKS + 1 }), remaining());
    if (rows.length > RAG_MAX_CHUNKS) throw new RetrievalError(422, 'Selected collection is too large. Select fewer documents.');
    const metadata = new Map(documents.map(d => {
      let pages: any[] = [];
      try { pages = JSON.parse(d.ocrMetadata || '{}').pages || []; } catch { /* Flag missing metadata below. */ }
      return [d.id, { ...d, pages: Array.isArray(pages) ? pages : [] }];
    }));
    const chunks = rows.map(row => {
      const doc = metadata.get(row.documentId)!;
      const page = doc.pages.find(p => p?.pageNumber === row.pageNumber);
      const flags: string[] = [];
      if (page?.hasLowConfidence) flags.push('low_confidence');
      if (page?.flagged) flags.push('flagged');
      if (!page && row.extractionMethod === 'paddle_ocr') flags.push('missing_ocr_metadata');
      return { ...row, ownerId: doc.userId, documentName: doc.originalName, ocrReviewFlags: flags, lowConfidence: flags.length > 0 };
    });
    const result = await retrievalTimeout(this.search(question, chunks, options), remaining());
    result.stats.totalMs = performance.now() - started;
    return result;
  }
}
