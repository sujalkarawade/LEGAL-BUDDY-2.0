import { AiService } from './ai/ai-service.js';
import { RuleEngineService } from './ai/rule-engine.js';
import type { EvidenceChunk } from './grounded-answer.js';
import type { ContractSummaryResult, ClauseFindingResult, CompletenessItemResult, ObligationResult, ChatAnswerResult } from './ai/ai-types.js';

/** Analysis service providing Generative AI (Groq / OpenRouter) with deterministic rule-based fallback */
export class LocalAnalysisService {
  static init(): void {
    AiService.init();
  }

  static async generateSummary(contractText: string, filename: string): Promise<ContractSummaryResult> {
    return AiService.generateSummary(contractText, filename);
  }

  static async analyzeClauses(contractText: string): Promise<ClauseFindingResult[]> {
    return RuleEngineService.analyzeClauses(contractText);
  }

  static async checkCompleteness(contractText: string, category: string): Promise<CompletenessItemResult[]> {
    return RuleEngineService.checkCompleteness(contractText, category);
  }

  static async extractObligations(contractText: string): Promise<ObligationResult[]> {
    return RuleEngineService.extractObligations(contractText);
  }

  static async answerQuestion(
    question: string,
    chunks: EvidenceChunk[],
    conversationHistory: Array<{ role: string; content: string }> = [],
    documentName = 'uploaded contract',
  ): Promise<ChatAnswerResult> {
    return AiService.answerQuestion(question, chunks, conversationHistory, documentName);
  }
}

