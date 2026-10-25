import { z } from 'zod';
import type { ChatAnswerResult } from './ai/ai-types.js';

export interface EvidenceChunk {
  id?: string; chunkIndex: number; pageNumber: number; content: string;
  score?: number; extractionMethod?: string; lowConfidence?: boolean;
  documentId?: string; ownerId?: string; documentName?: string; ocrReviewFlags?: string[];
}
const answerSchema = z.object({
  answer: z.string().trim().min(1).max(12000),
  insufficientEvidence: z.boolean(),
  sources: z.array(z.object({ chunkId: z.string(), excerpt: z.string().min(1).max(3000) })).max(10),
});

/** Validate source identity and literal text; the model never controls citation page numbers. */
export function validateGroundedAnswer(raw: string, chunks: EvidenceChunk[], documentName: string): ChatAnswerResult {
  const parsed = answerSchema.parse(JSON.parse(raw));
  if (parsed.insufficientEvidence) return {
    answer: 'The retrieved evidence is insufficient to answer this question. Please inspect the original document or ask a more specific question.',
    citations: [], insufficientEvidence: true, isDocumentGrounded: false, provider: '',
  };
  if (!parsed.sources.length) throw new Error('Supported answers require evidence.');
  const citations = parsed.sources.map(source => {
    const chunk = chunks.find(c => c.id === source.chunkId);
    if (!chunk || !chunk.content.includes(source.excerpt) || !source.excerpt.trim() || !Number.isInteger(chunk.pageNumber) || chunk.pageNumber < 1) {
      throw new Error('Unverifiable source reference.');
    }
    return { chunkId: chunk.id, documentId: chunk.documentId, excerpt: source.excerpt, pageNumber: chunk.pageNumber,
      documentName: chunk.documentName || documentName, score: chunk.score || 0, extractionMethod: chunk.extractionMethod,
      lowConfidence: chunk.lowConfidence, ocrReviewFlags: chunk.ocrReviewFlags, verified: true };
  });
  // Strip unsupported free-form page labels by rejecting the response, not guessing replacements.
  if (/\b(?:pages?|pp?\.)\s*\p{N}|पान\s*\p{N}/iu.test(parsed.answer)) throw new Error('Model-generated page reference.');
  const warning = citations.some(c => c.lowConfidence)
    ? 'Some supporting text has uncertain OCR. Verify it against the original scan.\n\n' : '';
  return { answer: warning + parsed.answer, citations, insufficientEvidence: false,
    isDocumentGrounded: true, provider: '' };
}
