import { AI_PROVIDER, GEMINI_API_KEY, RAG_EMBEDDING_MODEL, RAG_EMBEDDING_VERSION, RAG_RETRIEVAL_LIMIT } from '../config/index.js';

export interface RagChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  pageNumber: number;
  content: string;
  extractionMethod: string;
  clauseHeading: string | null;
  embedding: string | null;
  embeddingModel: string | null;
}

export interface RetrievedChunk extends RagChunk {
  score: number;
  lowConfidence: boolean;
  semanticMatched: boolean;
}

export function authorizedChunkFilter(documentId: string, userId: string) {
  return { documentId, document: { userId } };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Gemini text embeddings are stored alongside each chunk in the existing PostgreSQL table. */
export class RagService {
  static get embeddingEnabled(): boolean {
    return AI_PROVIDER !== 'heuristic' && Boolean(GEMINI_API_KEY.trim());
  }

  static get embeddingModel(): string {
    return RAG_EMBEDDING_VERSION;
  }

  static async embed(text: string, taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'): Promise<number[] | null> {
    if (!this.embeddingEnabled || !text.trim()) return null;
    if (text.length > 6000) throw new Error('Embedding input exceeds the supported chunk size.');
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(RAG_EMBEDDING_MODEL)}:embedContent`;
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
          body: JSON.stringify({
            model: `models/${RAG_EMBEDDING_MODEL}`,
            content: { parts: [{ text }] },
            taskType,
            outputDimensionality: 768,
          }),
          signal: AbortSignal.timeout(30000),
        });
        if (!response.ok) {
          const error = new Error(`Gemini embedding request failed (${response.status}).`);
          if (response.status !== 429 && response.status < 500) Object.assign(error, { permanent: true });
          throw error;
        }
        const payload = await response.json() as { embedding?: { values?: number[] } };
        const values = payload.embedding?.values;
        if (!Array.isArray(values) || values.length !== 768 || values.some((value) => !Number.isFinite(value)) || !values.some(value => value !== 0)) {
          throw new Error('Gemini returned an invalid embedding vector.');
        }
        return values;
      } catch (error) {
        lastError = error;
        if ((error as { permanent?: boolean }).permanent) throw error;
        if (attempt < 2) await sleep(350 * 2 ** attempt);
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Embedding request failed.');
  }

  static async embedChunks<T extends { content: string }>(chunks: T[]): Promise<Array<{ embedding: string | null; embeddingModel: string | null }>> {
    const output: Array<{ embedding: string | null; embeddingModel: string | null }> = [];
    for (let offset = 0; offset < chunks.length; offset += 4) {
      const batch = chunks.slice(offset, offset + 4);
      const vectors = await Promise.all(batch.map((chunk) => this.embed(chunk.content, 'RETRIEVAL_DOCUMENT')));
      for (const vector of vectors) {
        output.push({ embedding: vector ? JSON.stringify(vector) : null, embeddingModel: vector ? RAG_EMBEDDING_VERSION : null });
      }
    }
    return output;
  }

  static validVector(value: string | null): boolean {
    if (!value) return false;
    try {
      const vector = JSON.parse(value);
      return Array.isArray(vector) && vector.length === 768 && vector.every(Number.isFinite) && vector.some(n => n !== 0);
    } catch { return false; }
  }

  static async retrieve(question: string, chunks: RagChunk[], limit = RAG_RETRIEVAL_LIMIT): Promise<RetrievedChunk[]> {
    let queryVector: number[] | null = null;
    if (chunks.some(c => c.embeddingModel === this.embeddingModel && this.validVector(c.embedding))) {
      try { queryVector = await this.embed(question, 'RETRIEVAL_QUERY'); }
      catch { /* Explicit keyword fallback; do not mislabel it as semantic retrieval. */ }
    }
    const terms = this.terms(question);
    const clause = question.match(/(?:clause|section|article|कलम)\s+(\d+(?:\.\d+)*)/iu)?.[1];
    const tokenLists = chunks.map(c => this.terms(`${c.clauseHeading || ''} ${c.content}`));
    const frequencies = new Map<string, number>();
    for (const tokens of tokenLists) for (const term of tokens) frequencies.set(term, (frequencies.get(term) || 0) + 1);
    const ranked = chunks.map((chunk, index) => {
      const tokens = tokenLists[index];
      const tokenSet = new Set(tokens);
      const lexical = terms.reduce((score, term) => {
        if (!tokenSet.has(term)) return score;
        const frequency = frequencies.get(term) || 0;
        return score + Math.log(1 + chunks.length / (1 + frequency));
      }, 0) + (clause && tokenSet.has(clause) ? 8 : 0);
      const semanticMatched = Boolean(queryVector && chunk.embeddingModel === this.embeddingModel && this.validVector(chunk.embedding));
      const semantic = semanticMatched ? this.cosine(queryVector!, JSON.parse(chunk.embedding!)) : -1;
      return { ...chunk, score: 0, lowConfidence: false, semanticMatched, lexical, semantic };
    });
    const lexicalOrder = ranked.filter(c => c.lexical > 0).sort((a,b) => b.lexical - a.lexical);
    const semanticOrder = ranked.filter(c => c.semanticMatched).sort((a,b) => b.semantic - a.semantic);
    // Reciprocal rank fusion avoids pretending cosine scores are calibrated probabilities.
    for (const [index, chunk] of lexicalOrder.entries()) chunk.score += 1 / (60 + index + 1);
    for (const [index, chunk] of semanticOrder.entries()) chunk.score += 1 / (60 + index + 1);
    // No arbitrary semantic threshold: generation must select supporting evidence or abstain.
    return ranked.filter(c => c.score > 0).sort((a,b) => b.score - a.score || a.chunkIndex - b.chunkIndex)
      .slice(0, Math.max(1, Math.min(10, limit)));
  }

  private static terms(text: string): string[] {
    const stop = new Set(['the','and','for','with','from','that','this','what','when','where','which','who','does','are','was','were','has','have','is','of','in','to','a','an','it','say','contract','agreement','करारात','काय','आहे','का','कधी','कसे']);
    return Array.from(new Set((text.normalize('NFC').toLocaleLowerCase().match(/[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:[./-][\p{L}\p{M}\p{N}]+)*/gu) || [])
      .filter(term => !stop.has(term)).map(term => /^[a-z]{4,}s$/.test(term) && !term.endsWith('ss') ? term.slice(0, -1) : term)));
  }

  private static cosine(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i]; normA += a[i] * a[i]; normB += b[i] * b[i];
    }
    return normA && normB ? dot / Math.sqrt(normA * normB) : 0;
  }
}
