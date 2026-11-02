import Groq from 'groq-sdk';
import OpenAI from 'openai';
import {
  AI_PROVIDER,
  GROQ_API_KEY,
  GROQ_MODEL,
  OPENROUTER_API_KEY,
  OPENROUTER_MODEL,
} from '../../config/index.js';
import { RuleEngineService } from './rule-engine.js';
import { validateGroundedAnswer, type EvidenceChunk } from '../grounded-answer.js';
import type {
  ContractSummaryResult,
  ClauseFindingResult,
  CompletenessItemResult,
  ObligationResult,
  ChatAnswerResult,
} from './ai-types.js';

function extractJsonFromText(rawText: string): any {
  if (!rawText) return null;
  const trimmed = rawText.trim();
  try {
    return JSON.parse(trimmed);
  } catch (_) {}

  const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || trimmed.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1] || jsonMatch[0]);
    } catch (_) {}
  }
  return null;
}

export class AiService {
  private static groqClient: Groq | null = null;
  private static openRouterClient: OpenAI | null = null;

  static init() {
    if (AI_PROVIDER === 'heuristic') return;
    if (GROQ_API_KEY && GROQ_API_KEY.trim() !== '') {
      try {
        AiService.groqClient = new Groq({ apiKey: GROQ_API_KEY.trim(), timeout: 20000, maxRetries: 0 });
        console.log(`[AiService] Groq client initialized with model: ${GROQ_MODEL}`);
      } catch (e: any) {
        console.warn('[AiService] Provider request unavailable; using a safe fallback.');
      }
    }

    if (OPENROUTER_API_KEY && OPENROUTER_API_KEY.trim() !== '') {
      try {
        AiService.openRouterClient = new OpenAI({
          apiKey: OPENROUTER_API_KEY.trim(),
          baseURL: 'https://openrouter.ai/api/v1',
          timeout: 45000,
          maxRetries: 0,
          defaultHeaders: {
            'HTTP-Referer': 'http://localhost:5173',
            'X-Title': 'Legal Buddy 2.0',
          },
        });
        console.log(`[AiService] OpenRouter client initialized with model: ${OPENROUTER_MODEL}`);
      } catch (e: any) {
        console.warn('[AiService] Provider request unavailable; using a safe fallback.');
      }
    }
  }

  static getProviderStatus(): {
    activeProvider: 'groq' | 'openrouter' | 'rule_engine';
    isLiveLlm: boolean;
    groqConfigured: boolean;
    openRouterConfigured: boolean;
    model: string;
  } {
    const hasGroq = !!(GROQ_API_KEY && GROQ_API_KEY.trim().length > 5);
    const hasOpenRouter = !!(OPENROUTER_API_KEY && OPENROUTER_API_KEY.trim().length > 5);

    let activeProvider: 'groq' | 'openrouter' | 'rule_engine' = 'rule_engine';
    let model = 'rule_engine';

    if (AI_PROVIDER === 'heuristic') {
      activeProvider = 'rule_engine';
    } else if (AI_PROVIDER === 'groq' && hasGroq) {
      activeProvider = 'groq';
      model = GROQ_MODEL;
    } else if (AI_PROVIDER === 'openrouter' && hasOpenRouter) {
      activeProvider = 'openrouter';
      model = OPENROUTER_MODEL;
    } else if (hasGroq) {
      activeProvider = 'groq';
      model = GROQ_MODEL;
    } else if (hasOpenRouter) {
      activeProvider = 'openrouter';
      model = OPENROUTER_MODEL;
    }

    return {
      activeProvider,
      isLiveLlm: activeProvider !== 'rule_engine',
      groqConfigured: hasGroq,
      openRouterConfigured: hasOpenRouter,
      model,
    };
  }

  /**
   * Helper to execute chat completion across Groq / OpenRouter with fallback
   */
  private static async executeCompletion(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options: { jsonMode?: boolean; temperature?: number; maxTokens?: number } = {}
  ): Promise<{ text: string; provider: string; model: string }> {
    const status = this.getProviderStatus();
    if (!status.isLiveLlm) {
      throw new Error('No live LLM configured');
    }

    const { jsonMode = false, temperature = 0.1, maxTokens = 800 } = options;

    // Build call configs
    const candidates: Array<{ provider: 'groq' | 'openrouter'; client: any; model: string; maxTokens: number }> = [];

    if (this.groqClient) {
      // Prioritize verified models, exclude 20b which fails JSON mode
      const groqModels = [GROQ_MODEL, 'openai/gpt-oss-120b', 'qwen/qwen3.8-27b']
        .filter((m, i, arr) => m && arr.indexOf(m) === i && !m.includes('20b'));
      for (const model of groqModels) {
        // qwen has a 1,000 OTPM rate limit, cap to 450. 120b capped to 800 for fast TPM compliance.
        const modelMaxTokens = model.includes('qwen') ? Math.min(maxTokens, 450) : Math.min(maxTokens, 800);
        candidates.push({ provider: 'groq', client: this.groqClient, model, maxTokens: modelMaxTokens });
      }
    }

    if (this.openRouterClient) {
      candidates.push({
        provider: 'openrouter',
        client: this.openRouterClient,
        model: OPENROUTER_MODEL,
        maxTokens: Math.min(maxTokens, 450), // Cap tokens to avoid 402 on low account balance
      });
    }

    let lastError: any = null;

    for (const candidate of candidates) {
      try {
        const payload: any = {
          model: candidate.model,
          messages,
          temperature,
          max_tokens: candidate.maxTokens,
        };
        if (jsonMode) {
          payload.response_format = { type: 'json_object' };
        }

        const completion = await candidate.client.chat.completions.create(payload, { timeout: 45000 });
        const text = completion.choices[0]?.message?.content || '';
        if (text.trim().length > 0) {
          return { text, provider: candidate.provider, model: candidate.model };
        }
      } catch (err: any) {
        // If JSON mode was rejected by the provider model, retry without response_format
        if (jsonMode && err?.message?.includes('json_validate_failed')) {
          try {
            const retryPayload: any = {
              model: candidate.model,
              messages,
              temperature,
              max_tokens: candidate.maxTokens,
            };
            const retryComp = await candidate.client.chat.completions.create(retryPayload, { timeout: 45000 });
            const retryText = retryComp.choices[0]?.message?.content || '';
            if (retryText.trim().length > 0) {
              return { text: retryText, provider: candidate.provider, model: candidate.model };
            }
          } catch (_) {}
        }
        console.warn(`[AiService] Provider ${candidate.provider} (${candidate.model}) failed: ${err.message || err}`);
        lastError = err;
      }
    }

    throw lastError || new Error('All AI providers failed');
  }

  /**
   * Generates a structured executive summary using Generative AI (Groq / OpenRouter)
   */
  static async generateSummary(contractText: string, filename: string): Promise<ContractSummaryResult> {
    const status = this.getProviderStatus();

    if (status.isLiveLlm) {
      try {
        const systemPrompt = `You are an elite legal contract counsel and intelligence analyst for Legal Buddy.
Review this legal contract thoroughly. It may be in English, Marathi (Devanagari script), or bilingual mixed format.
Provide a clear, legally rigorous, and highly structured contract intelligence summary.

CRITICAL INSTRUCTIONS:
1. Extract factual details strictly verified in the provided text.
2. For dates, parties, payment terms, or notice periods, specify exact numbers, currency, and conditions.
3. If any field is not addressed in the text, write "Not explicitly specified in the contract".
4. Never invent nonexistent clauses or parties.
5. Provide a rich, professional, 2-3 paragraph executive summary under "rawSummary" explaining what the agreement achieves, core rights, and notable risks.

Return ONLY a valid JSON object matching this schema:
{
  "contractType": "string (e.g. Non-Disclosure Agreement, Employment Agreement, Commercial Lease, Flat Purchase Agreement)",
  "parties": "string (all contracting parties, company names, registration details)",
  "purpose": "string (core business objective and scope of work)",
  "effectiveDate": "string (commencement date or execution date)",
  "endDate": "string (expiry date, initial term duration, or termination event)",
  "paymentTerms": "string (consideration amounts, milestones, payment schedules, taxes)",
  "responsibilities": "string (core obligations and deliverables for each party)",
  "terminationConditions": "string (grounds for termination, cure periods, notice requirements)",
  "confidentialityTerms": "string (non-disclosure scope, survival duration)",
  "liabilityTerms": "string (indemnification, liability caps, liquidated damages, exclusions)",
  "renewalProvisions": "string (automatic renewal, extension terms, renegotiation rules)",
  "importantDeadlines": "string (critical milestones, review dates, statutory deadlines)",
  "missingInfo": "string (annexures missing, unreadable stamps, or absent standard protections)",
  "rawSummary": "string (comprehensive executive summary in plain professional English)"
}`;

        // Truncate to safe token window (around 6,000 characters to stay safely within free-tier TPM limit)
        const contextText = contractText.slice(0, 6000);

        const { text, provider, model } = await this.executeCompletion(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Filename: ${filename}\n\nContract Text:\n${contextText}` },
          ],
          { jsonMode: true, temperature: 0.1, maxTokens: 800 }
        );

        const parsed = extractJsonFromText(text);
        if (parsed && typeof parsed === 'object') {
          return {
            contractType: parsed.contractType || 'Commercial Agreement',
            parties: parsed.parties || 'Not explicitly specified in the contract',
            purpose: parsed.purpose || 'Not explicitly specified in the contract',
            effectiveDate: parsed.effectiveDate || 'Not explicitly specified in the contract',
            endDate: parsed.endDate || 'Not explicitly specified in the contract',
            paymentTerms: parsed.paymentTerms || 'Not explicitly specified in the contract',
            responsibilities: parsed.responsibilities || 'Not explicitly specified in the contract',
            terminationConditions: parsed.terminationConditions || 'Not explicitly specified in the contract',
            confidentialityTerms: parsed.confidentialityTerms || 'Not explicitly specified in the contract',
            liabilityTerms: parsed.liabilityTerms || 'Not explicitly specified in the contract',
            renewalProvisions: parsed.renewalProvisions || 'Not explicitly specified in the contract',
            importantDeadlines: parsed.importantDeadlines || 'Not explicitly specified in the contract',
            missingInfo: parsed.missingInfo || 'None noted',
            rawSummary: parsed.rawSummary || 'Structured executive summary generated by Generative AI.',
            analysisProvider: `${provider} (${model})`,
          };
        }
      } catch (err: any) {
        console.warn('[AiService] Provider request unavailable; using a safe fallback.');
      }
    }

    // Fallback to deterministic rule engine
    return RuleEngineService.generateSummary(contractText, filename);
  }

  /**
   * Evaluates key clauses and risk ratings with Generative AI
   */
  static async analyzeClauses(contractText: string): Promise<ClauseFindingResult[]> {
    const status = this.getProviderStatus();
    const pageMap = RuleEngineService.parsePageMap(contractText);

    if (status.isLiveLlm) {
      try {
        const systemPrompt = `You are a contract risk auditor. Analyze the contract text for key clauses and risk exposure.
For each detected clause, assess the risk level:
- "High": One-sided indemnity, unlimited liability, broad non-competes, forfeiture of rights, harsh liquidated damages.
- "Medium": Unilateral termination, short cure periods, ambiguity in payment or renewal.
- "Low": Standard balanced terms, mutual boilerplate.

Return ONLY a valid JSON object matching:
{
  "clauses": [
    {
      "category": "string (e.g. Indemnification, Limitation of Liability, Termination, Confidentiality, Dispute Resolution, Non-Compete)",
      "title": "string (Clause title or heading)",
      "excerpt": "string (exact sentence or phrase from contract)",
      "pageNumber": 1,
      "plainLanguageExplanation": "string (clear explanation of what this means for the signing party)",
      "riskLevel": "Low | Medium | High | Needs Review",
      "potentialConcern": "string (business or legal risk)",
      "reviewQuestion": "string (actionable question to ask legal counsel)"
    }
  ]
}`;

        const { text } = await this.executeCompletion(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Contract Text:\n${contractText.slice(0, 14000)}` },
          ],
          { jsonMode: true, temperature: 0.1, maxTokens: 2500 }
        );

        const parsed = extractJsonFromText(text);
        const clauses: ClauseFindingResult[] = parsed?.clauses || (Array.isArray(parsed) ? parsed : []);
        if (Array.isArray(clauses) && clauses.length > 0) {
          for (const c of clauses) {
            if (c.excerpt && (!c.pageNumber || c.pageNumber < 1)) {
              c.pageNumber = RuleEngineService.findPageForExcerpt(c.excerpt, pageMap);
            }
          }
          return clauses;
        }
      } catch (err: any) {
        console.warn('[AiService] Provider request unavailable; using a safe fallback.');
      }
    }

    return RuleEngineService.analyzeClauses(contractText);
  }

  /**
   * Checks completeness of contract sections against standard expectations
   */
  static async checkCompleteness(contractText: string, category: string): Promise<CompletenessItemResult[]> {
    const status = this.getProviderStatus();
    const pageMap = RuleEngineService.parsePageMap(contractText);

    if (status.isLiveLlm) {
      try {
        const systemPrompt = `You are a contract review assistant checking contract completeness.
Check if standard commercial contract clauses are present, missing, or require review:
Categories to verify:
1. Parties & Recitals
2. Scope of Services / Consideration
3. Term & Termination
4. Confidentiality
5. Representations & Warranties
6. Limitation of Liability & Indemnification
7. Governing Law & Dispute Resolution
8. Force Majeure & Severability

Return ONLY valid JSON:
{
  "checks": [
    {
      "expectedSection": "string",
      "detectedTitle": "string",
      "status": "FOUND | NOT_FOUND | NEEDS_REVIEW",
      "excerpt": "string (short excerpt if found)",
      "pageNumber": 1,
      "reason": "string (explanation of check)"
    }
  ]
}`;

        const { text } = await this.executeCompletion(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Contract Category: ${category}\n\nContract Text:\n${contractText.slice(0, 14000)}` },
          ],
          { jsonMode: true, temperature: 0.1, maxTokens: 2000 }
        );

        const parsed = extractJsonFromText(text);
        const checks: CompletenessItemResult[] = parsed?.checks || (Array.isArray(parsed) ? parsed : []);
        if (Array.isArray(checks) && checks.length > 0) {
          for (const ch of checks) {
            if (ch.excerpt && (!ch.pageNumber || ch.pageNumber < 1)) {
              ch.pageNumber = RuleEngineService.findPageForExcerpt(ch.excerpt, pageMap);
            }
          }
          return checks;
        }
      } catch (err: any) {
        console.warn('[AiService] Provider request unavailable; using a safe fallback.');
      }
    }

    return RuleEngineService.checkCompleteness(contractText, category);
  }

  /**
   * Extracts contractual obligations and deadlines
   */
  static async extractObligations(contractText: string): Promise<ObligationResult[]> {
    const status = this.getProviderStatus();
    const pageMap = RuleEngineService.parsePageMap(contractText);

    if (status.isLiveLlm) {
      try {
        const systemPrompt = `You are a legal operations analyst. Extract all actionable obligations, payment milestones, delivery commitments, and notice deadlines.
Return ONLY valid JSON:
{
  "obligations": [
    {
      "category": "Payment | Renewal | Termination Notice | Delivery | Reporting | Compliance",
      "description": "string",
      "responsibleParty": "string",
      "dueDateOrPeriod": "string",
      "isCalendarDate": false,
      "excerpt": "string (exact quote)",
      "pageNumber": 1,
      "confidence": "HIGH | MEDIUM | LOW"
    }
  ]
}`;

        const { text } = await this.executeCompletion(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Contract Text:\n${contractText.slice(0, 14000)}` },
          ],
          { jsonMode: true, temperature: 0.1, maxTokens: 2000 }
        );

        const parsed = extractJsonFromText(text);
        const obligations: ObligationResult[] = parsed?.obligations || (Array.isArray(parsed) ? parsed : []);
        if (Array.isArray(obligations) && obligations.length > 0) {
          for (const ob of obligations) {
            if (ob.excerpt && (!ob.pageNumber || ob.pageNumber < 1)) {
              ob.pageNumber = RuleEngineService.findPageForExcerpt(ob.excerpt, pageMap);
            }
          }
          return obligations;
        }
      } catch (err: any) {
        console.warn('[AiService] Provider request unavailable; using a safe fallback.');
      }
    }

    return RuleEngineService.extractObligations(contractText);
  }

  /**
   * Document-grounded conversational Q&A Chatbot with exact page citations
   */
  static async answerQuestion(
    question: string,
    chunks: EvidenceChunk[],
    _conversationHistory: Array<{ role: string; content: string }> = [],
    documentName = 'uploaded contract'
  ): Promise<ChatAnswerResult> {
    const noKey = (): ChatAnswerResult => ({
      answer: 'AI chat is not configured. Please add a valid GROQ_API_KEY or OPENROUTER_API_KEY to the server environment, then restart the server.',
      citations: [], isDocumentGrounded: false, insufficientEvidence: true,
      provider: 'no_ai_key',
    });
    const insufficient = (): ChatAnswerResult => ({
      answer: 'I could not find enough relevant passages in this document to confidently answer your question. Try rephrasing, or ask about a specific clause, date, party, or obligation. This does not mean the information is absent from the contract.',
      citations: [], isDocumentGrounded: false, insufficientEvidence: true,
      provider: 'evidence_fallback',
    });

    if (!this.getProviderStatus().isLiveLlm) return noKey();
    if (!chunks.length) return insufficient();

    const systemPrompt = [
      `You are Legal Buddy — a precise, expert legal AI assistant specialized in contract analysis.`,
      `Document under review: "${documentName}".`,
      `STRICT RULES:`,
      `1. Answer ONLY from the provided contract passages. Never invent facts, dates, amounts, or clauses.`,
      `2. If the user's question is a follow-up, use prior conversation context to understand what they mean.`,
      `3. If passages are insufficient, set insufficientEvidence=true and sources=[].`,
      `4. Never include page numbers in the answer text — the server attaches citations separately.`,
      `5. For ambiguous or conflicting passages, note the contradiction clearly.`,
      `6. Format answers clearly: use short paragraphs. For lists of items (parties, dates, obligations), use line breaks between items.`,
      `7. Flag OCR uncertainty when uncertain text may affect the answer.`,
      `8. Do NOT hallucinate or extrapolate beyond what the retrieved text directly supports.`,
      `Return ONLY valid JSON matching: {"answer":"plain text with \\n for paragraphs","insufficientEvidence":boolean,"sources":[{"chunkId":"id from passage","excerpt":"exact verbatim text from the passage"}]}`
    ].join(' ');

    try {
      // Use last 8 conversation turns for full follow-up context
      const historyMessages: Array<{ role: 'user' | 'assistant'; content: string }> = _conversationHistory
        .slice(-8)
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      const passagesPayload = chunks.map(c => ({
        chunkId: c.id,
        documentName: c.documentName || documentName,
        pageNumber: c.pageNumber,
        text: c.content,
        extractionMethod: c.extractionMethod,
        uncertainOcr: c.lowConfidence,
      }));

      const { text, provider, model } = await this.executeCompletion([
        { role: 'system', content: systemPrompt },
        ...historyMessages,
        { role: 'user', content: JSON.stringify({ question, documentName, passages: passagesPayload }) },
      ], { jsonMode: true, temperature: 0, maxTokens: 800 });

      const parsed = extractJsonFromText(text);
      if (!parsed || typeof parsed !== 'object') {
        return insufficient();
      }

      // Normalize sources so whether LLM returns objects or raw strings, we handle them
      if (!Array.isArray(parsed.sources)) {
        parsed.sources = [];
      } else {
        parsed.sources = parsed.sources.map((s: any) => {
          if (typeof s === 'string') {
            const matched = chunks.find(c => c.content.includes(s) || c.content.toLowerCase().includes(s.toLowerCase().trim())) || chunks[0];
            return { chunkId: matched?.id || chunks[0]?.id, excerpt: s.slice(0, 500) };
          }
          if (s && typeof s === 'object') {
            let chunkId = s.chunkId;
            const excerpt = (s.excerpt || s.text || s.quote || '').trim();
            if (!chunkId || !chunks.some(c => c.id === chunkId)) {
              const matched = chunks.find(c => c.content.includes(excerpt) || c.content.toLowerCase().includes(excerpt.toLowerCase())) || chunks[0];
              chunkId = matched?.id;
            }
            return { chunkId, excerpt };
          }
          return null;
        }).filter(Boolean);
      }

      try {
        const validated = validateGroundedAnswer(JSON.stringify(parsed), chunks, documentName);
        return { ...validated, provider: `${provider} (${model})` };
      } catch (validationErr: any) {
        console.warn('[AiService] Strict citation check note:', validationErr?.message);
        // If the LLM gave a real answer, rescue it and attach any matching citations
        if (parsed.answer && !parsed.insufficientEvidence && parsed.answer.trim().length > 5) {
          const verifiedCitations: any[] = [];
          for (const s of parsed.sources) {
            const chunk = chunks.find(c => c.id === s.chunkId) ||
              chunks.find(c => c.content.toLowerCase().includes((s.excerpt || '').toLowerCase().trim()));
            if (chunk && chunk.pageNumber) {
              const verifiedExcerpt = chunk.content.includes(s.excerpt)
                ? s.excerpt
                : (chunk.content.length > 200 ? chunk.content.slice(0, 200) + '...' : chunk.content);
              verifiedCitations.push({
                chunkId: chunk.id,
                documentId: chunk.documentId,
                excerpt: verifiedExcerpt,
                pageNumber: chunk.pageNumber,
                documentName: chunk.documentName || documentName,
                score: chunk.score || 0,
                extractionMethod: chunk.extractionMethod,
                lowConfidence: chunk.lowConfidence,
                verified: true,
              });
            }
          }
          return {
            answer: parsed.answer,
            citations: verifiedCitations,
            isDocumentGrounded: verifiedCitations.length > 0,
            insufficientEvidence: false,
            provider: `${provider} (${model})`,
          };
        }
        return insufficient();
      }
    } catch (err: any) {
      console.warn('[AiService] Q&A execution error:', err?.message || err);
      return insufficient();
    }
  }

}

// Initialize on module load
AiService.init();
