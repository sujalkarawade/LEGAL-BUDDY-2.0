import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import {
  GROQ_API_KEY,
  LLM_MODEL,
  GEMINI_API_KEY,
  OPENAI_API_KEY,
  AI_PROVIDER,
} from '../../config/index.js';
import { RuleEngineService } from './rule-engine.js';
import {
  ContractSummaryResult,
  ClauseFindingResult,
  CompletenessItemResult,
  ObligationResult,
  ChatAnswerResult,
} from './ai-types.js';

/**
 * Resolves the Groq model identifier.
 * Maps 'meta-llama/llama-3.3-70b-instruct' or aliases to Groq's official 'llama-3.3-70b-versatile'.
 */
function resolveGroqModel(modelName: string = LLM_MODEL): string {
  const trimmed = (modelName || '').trim();
  if (GROQ_API_KEY && GROQ_API_KEY.startsWith('sk-or-v1-')) {
    return trimmed || 'meta-llama/llama-3.3-70b-instruct';
  }
  if (
    trimmed === 'meta-llama/llama-3.3-70b-instruct' ||
    trimmed === 'meta-llama/llama-3.3-70b' ||
    trimmed === 'llama-3.3-70b' ||
    trimmed.includes('llama-3.3-70b')
  ) {
    return 'llama-3.3-70b-versatile';
  }
  return trimmed || 'llama-3.3-70b-versatile';
}

function extractJsonFromText(rawText: string): any {
  if (!rawText) return null;
  try {
    return JSON.parse(rawText.trim());
  } catch (_) {}

  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || rawText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1] || jsonMatch[0]);
    } catch (_) {}
  }
  return null;
}

export class AIAdapter {
  private static groqClient: any = null;
  private static geminiClient: GoogleGenerativeAI | null = null;
  private static openaiClient: OpenAI | null = null;

  static init() {
    // 1. Initialize Groq / OpenRouter Meta-Llama 3.3 70B Client (Top Priority)
    if (GROQ_API_KEY && GROQ_API_KEY.trim() !== '') {
      try {
        if (GROQ_API_KEY.startsWith('sk-or-v1-')) {
          AIAdapter.groqClient = new OpenAI({
            apiKey: GROQ_API_KEY.trim(),
            baseURL: 'https://openrouter.ai/api/v1',
            timeout: 60000,
            defaultHeaders: {
              'HTTP-Referer': 'http://localhost:5173',
              'X-Title': 'Legal Buddy',
            },
          });
          console.log(`[AIAdapter] Initialized OpenRouter client with Meta-Llama 3.3 70B (${resolveGroqModel(LLM_MODEL)})`);
        } else {
          AIAdapter.groqClient = new Groq({ apiKey: GROQ_API_KEY.trim(), timeout: 60000 });
          console.log(`[AIAdapter] Initialized Groq client with model: ${resolveGroqModel(LLM_MODEL)}`);
        }
      } catch (e) {
        console.warn('Failed to initialize Groq/Llama AI client:', e);
      }
    }

    // 2. Initialize Gemini
    if (GEMINI_API_KEY && GEMINI_API_KEY.trim() !== '') {
      try {
        AIAdapter.geminiClient = new GoogleGenerativeAI(GEMINI_API_KEY);
      } catch (e) {
        console.warn('Failed to initialize Gemini AI client:', e);
      }
    }

    // 3. Initialize OpenAI
    if (OPENAI_API_KEY && OPENAI_API_KEY.trim() !== '') {
      try {
        AIAdapter.openaiClient = new OpenAI({ apiKey: OPENAI_API_KEY });
      } catch (e) {
        console.warn('Failed to initialize OpenAI client:', e);
      }
    }
  }

  static getProviderStatus(): {
    activeProvider: 'groq' | 'gemini' | 'openai' | 'rule_engine';
    isLiveLlm: boolean;
    groqConfigured: boolean;
    geminiConfigured: boolean;
    openaiConfigured: boolean;
    model: string;
    notice: string;
  } {
    const hasGroq = !!(GROQ_API_KEY && GROQ_API_KEY.trim().length > 5);
    const hasGemini = !!(GEMINI_API_KEY && GEMINI_API_KEY.trim().length > 5);
    const hasOpenAI = !!(OPENAI_API_KEY && OPENAI_API_KEY.trim().length > 5);

    let activeProvider: 'groq' | 'gemini' | 'openai' | 'rule_engine' = 'rule_engine';

    if (AI_PROVIDER === 'groq' && hasGroq) {
      activeProvider = 'groq';
    } else if (AI_PROVIDER === 'gemini' && hasGemini) {
      activeProvider = 'gemini';
    } else if (AI_PROVIDER === 'openai' && hasOpenAI) {
      activeProvider = 'openai';
    } else if (hasGroq) {
      // Groq is priority live provider
      activeProvider = 'groq';
    } else if (hasGemini) {
      activeProvider = 'gemini';
    } else if (hasOpenAI) {
      activeProvider = 'openai';
    }

    const isLiveLlm = activeProvider !== 'rule_engine';
    const activeModel = activeProvider === 'groq' ? LLM_MODEL : activeProvider;
    const notice = isLiveLlm
      ? `Live neural reasoning active (Neural Legal Engine — ${activeModel}). High-speed contract intelligence enabled.`
      : `Deterministic Heuristic Engine active (Offline Mode). Operating with evidence-backed legal rule extraction. To activate neural reasoning with Meta-Llama 3.3 70B, provide GROQ_API_KEY in server/.env.`;

    return {
      activeProvider,
      isLiveLlm,
      groqConfigured: hasGroq,
      geminiConfigured: hasGemini,
      openaiConfigured: hasOpenAI,
      model: LLM_MODEL,
      notice,
    };
  }

  /**
   * Generates a contract summary using configured LLM (Groq Llama 3.3 70B) or fallback.
   */
  static async generateSummary(contractText: string, filename: string): Promise<ContractSummaryResult> {
    const status = this.getProviderStatus();

    // 1. Try Groq Llama 3.3 70B
    if (status.activeProvider === 'groq' && this.groqClient) {
      try {
        const modelId = resolveGroqModel(LLM_MODEL);
        const systemPrompt = `You are a senior contract attorney assistant for Legal Buddy.
Analyze the following extracted contract text carefully. It may contain English, Marathi (Devanagari script), or mixed bilingual legal terms (e.g., पावती, करारनामा, सूची क्र. २, मोबदला, मुद्रांक शुल्क, Haveli Pune Sub-Registrar).
Interpret Marathi legal concepts accurately into clear English or dual bilingual terms.
CRITICAL SAFEGUARD:
- Extract factual details strictly present in the text.
- If any field cannot be found or is blurred/unreadable, set its value strictly to "Not found in document".
- NEVER invent or fabricate missing text or terms. If text quality is low or unreadable, explicitly note it under "missingInfo".

Output strictly valid JSON matching this schema:
{
  "contractType": "string",
  "parties": "string (identifying each party clearly, including Marathi party names)",
  "purpose": "string",
  "effectiveDate": "string",
  "endDate": "string",
  "paymentTerms": "string (including consideration / मोबदला / stamp duty)",
  "responsibilities": "string",
  "terminationConditions": "string",
  "confidentialityTerms": "string",
  "liabilityTerms": "string",
  "renewalProvisions": "string",
  "importantDeadlines": "string",
  "missingInfo": "string (note any unreadable/uncertain sections or missing annexures)",
  "rawSummary": "string (concise 2-3 paragraph executive summary)"
}`;

        const completion = await this.groqClient.chat.completions.create({
          model: modelId,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Contract Text:\n${contractText.slice(0, 32000)}` },
          ],
          temperature: 0.1,
        });

        const rawJson = completion.choices[0]?.message?.content || '{}';
        const parsed = extractJsonFromText(rawJson) || {};
        return {
          contractType: parsed.contractType || 'Commercial Agreement',
          parties: parsed.parties || 'Not found in document',
          purpose: parsed.purpose || 'Not found in document',
          effectiveDate: parsed.effectiveDate || 'Not found in document',
          endDate: parsed.endDate || 'Not found in document',
          paymentTerms: parsed.paymentTerms || 'Not found in document',
          responsibilities: parsed.responsibilities || 'Not found in document',
          terminationConditions: parsed.terminationConditions || 'Not found in document',
          confidentialityTerms: parsed.confidentialityTerms || 'Not found in document',
          liabilityTerms: parsed.liabilityTerms || 'Not found in document',
          renewalProvisions: parsed.renewalProvisions || 'Not found in document',
          importantDeadlines: parsed.importantDeadlines || 'Not found in document',
          missingInfo: parsed.missingInfo || 'Not found in document',
          rawSummary: parsed.rawSummary || 'Summary generated by Meta-Llama 3.3 70B.',
          analysisProvider: `neural_ai (${modelId})`,
        };
      } catch (err) {
        console.warn('Groq summary generation failed, falling back:', err);
      }
    }

    // 2. Try Gemini
    if (status.activeProvider === 'gemini' && this.geminiClient) {
      try {
        const model = this.geminiClient.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const prompt = `You are a senior contract attorney assistant for Legal Buddy.
Analyze the following extracted contract text carefully. It may contain English, Marathi (Devanagari script), or mixed bilingual legal terms (e.g., पावती, करारनामा, सूची क्र. २, मोबदला, मुद्रांक शुल्क).
Interpret Marathi legal concepts accurately into clear English or dual bilingual terms.
CRITICAL:
- Extract factual details strictly present in the text.
- If any field cannot be found or is unreadable, set its value strictly to "Not found in document".
- NEVER invent or fabricate missing text. Note uncertain sections under "missingInfo".

Contract Text:
${contractText.slice(0, 35000)}

Respond strictly in valid JSON matching this schema:
{
  "contractType": "string",
  "parties": "string",
  "purpose": "string",
  "effectiveDate": "string",
  "endDate": "string",
  "paymentTerms": "string",
  "responsibilities": "string",
  "terminationConditions": "string",
  "confidentialityTerms": "string",
  "liabilityTerms": "string",
  "renewalProvisions": "string",
  "importantDeadlines": "string",
  "missingInfo": "string",
  "rawSummary": "string"
}`;

        const response = await model.generateContent(prompt);
        const textResp = response.response.text();
        const jsonMatch = textResp.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            ...parsed,
            analysisProvider: 'gemini',
          };
        }
      } catch (err) {
        console.warn('Gemini summary generation failed, falling back to rule engine:', err);
      }
    }

    // 3. Fallback to high-fidelity deterministic engine
    return RuleEngineService.generateSummary(contractText, filename);
  }

  /**
   * Identifies contract clauses and assesses risk.
   */
  static async analyzeClauses(contractText: string): Promise<ClauseFindingResult[]> {
    const status = this.getProviderStatus();
    const pageMap = RuleEngineService.parsePageMap(contractText);

    // 1. Try Groq Llama 3.3 70B
    if (status.activeProvider === 'groq' && this.groqClient) {
      try {
        const modelId = resolveGroqModel(LLM_MODEL);
        const systemPrompt = `You are a contract intelligence analyst for Legal Buddy.
Review this contract text (which may be in English, Marathi, or mixed bilingual format) and identify critical clauses across categories: Payment, Termination, Confidentiality, Liability, Intellectual Property, Dispute Resolution, Governing Law, Renewal, Penalties, Data Protection.
CRITICAL REQUIREMENTS:
1. Quote an exact original excerpt from the text (do not fabricate or translate the original excerpt).
2. Set "pageNumber" strictly to the source page number where the excerpt appears (look at the --- PAGE_X --- headers).
3. Provide a clear plain-language explanation in English.
4. Assign a risk level: "Low", "Medium", "High", or "Needs Review".
5. Detail the potential concern or ambiguity.
6. Provide a suggested question for human legal counsel review.
7. NEVER invent clauses that do not appear in the text.

Return strictly a valid JSON object containing a "clauses" array:
{
  "clauses": [
    {
      "category": "string",
      "title": "string",
      "excerpt": "string",
      "pageNumber": 1,
      "plainLanguageExplanation": "string",
      "riskLevel": "Low | Medium | High | Needs Review",
      "potentialConcern": "string",
      "reviewQuestion": "string"
    }
  ]
}`;

        const completion = await this.groqClient.chat.completions.create({
          model: modelId,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Contract Text:\n${contractText.slice(0, 32000)}` },
          ],
          temperature: 0.1,
        });

        const rawJson = completion.choices[0]?.message?.content || '{}';
        const parsed = extractJsonFromText(rawJson);
        const clauses: ClauseFindingResult[] = parsed?.clauses || (Array.isArray(parsed) ? parsed : []);
        if (Array.isArray(clauses) && clauses.length > 0) {
          // Double-check page citations with exact excerpt mapping
          for (const c of clauses) {
            if (!c.pageNumber || c.pageNumber < 1) {
              c.pageNumber = RuleEngineService.findPageForExcerpt(c.excerpt, pageMap);
            }
          }
          return clauses;
        }
      } catch (err) {
        console.warn('Groq clause analysis failed, falling back:', err);
      }
    }

    // 2. Try Gemini
    if (status.activeProvider === 'gemini' && this.geminiClient) {
      try {
        const model = this.geminiClient.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const prompt = `You are a contract intelligence analyst for Legal Buddy.
Review this contract text and identify critical clauses across categories: Payment, Termination, Confidentiality, Liability, Intellectual Property, Dispute Resolution, Governing Law, Renewal, Penalties, Data Protection.
For each clause found:
1. Quote an exact original excerpt from the text (do not fabricate).
2. Provide a plain-language explanation.
3. Assign a risk level: "Low", "Medium", "High", or "Needs Review" based on standard legal risk factors.
4. Detail the potential concern or ambiguity.
5. Provide a suggested question for human legal counsel review.

Contract Text:
${contractText.slice(0, 35000)}

Return strictly valid JSON:
[
  {
    "category": "string",
    "title": "string",
    "excerpt": "string",
    "pageNumber": 1,
    "plainLanguageExplanation": "string",
    "riskLevel": "Low | Medium | High | Needs Review",
    "potentialConcern": "string",
    "reviewQuestion": "string"
  }
]`;

        const response = await model.generateContent(prompt);
        const textResp = response.response.text();
        const jsonMatch = textResp.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed: ClauseFindingResult[] = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed) && parsed.length > 0) {
            for (const c of parsed) {
              if (!c.pageNumber || c.pageNumber < 1) {
                c.pageNumber = RuleEngineService.findPageForExcerpt(c.excerpt, pageMap);
              }
            }
            return parsed;
          }
        }
      } catch (err) {
        console.warn('Gemini clause analysis failed, falling back to rule engine:', err);
      }
    }

    return RuleEngineService.analyzeClauses(contractText);
  }

  /**
   * Evaluates contract completeness against standard categories using Groq Llama 3.3 70B or fallback.
   */
  static async checkCompleteness(contractText: string, category: string): Promise<CompletenessItemResult[]> {
    const status = this.getProviderStatus();
    const pageMap = RuleEngineService.parsePageMap(contractText);

    if (status.activeProvider === 'groq' && this.groqClient) {
      try {
        const modelId = resolveGroqModel(LLM_MODEL);
        const systemPrompt = `You are a senior contract compliance auditor for Legal Buddy.
Evaluate this contract against standard required sections for a "${category || 'Commercial Agreement'}":
1. Identification of Parties & Recitals
2. Scope of Agreement / Grant of Rights
3. Payment Terms, Consideration & Taxes (मोबदला, Stamp Duty, Invoicing)
4. Term, Expiration & Termination Remedies
5. Confidentiality & Non-Disclosure
6. Representations & Warranties
7. Limitation of Liability & Indemnification
8. Governing Law, Dispute Resolution & Jurisdiction
9. Execution, Signatures & Attestation

For each expected section return:
- expectedSection: Standard required provision name
- detectedTitle: Exact title or heading detected in the text, or null if missing
- status: "FOUND" (clearly present), "NOT_FOUND" (absent), or "NEEDS_REVIEW" (ambiguous/incomplete)
- excerpt: Quoted excerpt from text (or empty if NOT_FOUND)
- pageNumber: Source page number where it appears
- reason: Concise audit rationale

Return strictly valid JSON:
{
  "checks": [
    {
      "expectedSection": "string",
      "detectedTitle": "string",
      "status": "FOUND | NOT_FOUND | NEEDS_REVIEW",
      "excerpt": "string",
      "pageNumber": 1,
      "reason": "string"
    }
  ]
}`;

        const completion = await this.groqClient.chat.completions.create({
          model: modelId,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Contract Text:\n${contractText.slice(0, 30000)}` },
          ],
          temperature: 0.1,
          max_tokens: 2000,
        });

        const rawJson = completion.choices[0]?.message?.content || '{}';
        const parsed = extractJsonFromText(rawJson);
        const checks: CompletenessItemResult[] = parsed?.checks || (Array.isArray(parsed) ? parsed : []);
        if (Array.isArray(checks) && checks.length > 0) {
          for (const ch of checks) {
            if (ch.excerpt && (!ch.pageNumber || ch.pageNumber < 1)) {
              ch.pageNumber = RuleEngineService.findPageForExcerpt(ch.excerpt, pageMap);
            }
          }
          return checks;
        }
      } catch (err) {
        console.warn('Groq completeness check failed, falling back:', err);
      }
    }

    return RuleEngineService.checkCompleteness(contractText, category);
  }

  /**
   * Extracts contractual obligations and dates using Groq Llama 3.3 70B or fallback.
   */
  static async extractObligations(contractText: string): Promise<ObligationResult[]> {
    const status = this.getProviderStatus();
    const pageMap = RuleEngineService.parsePageMap(contractText);

    if (status.activeProvider === 'groq' && this.groqClient) {
      try {
        const modelId = resolveGroqModel(LLM_MODEL);
        const systemPrompt = `You are a legal operations analyst for Legal Buddy.
Review this contract (which may be in English, Marathi, or mixed bilingual format) and extract all actionable contractual obligations, payment milestones, delivery commitments, and notice deadlines.
For each obligation:
- category: "Payment", "Renewal", "Termination Notice", "Delivery", "Reporting", or "Compliance"
- description: Concise summary of what must be performed
- responsibleParty: Obligated party name or role (e.g. Purchaser, Promoter, Vendor, Client)
- dueDateOrPeriod: Deadline, period, or milestone (e.g. "Within 15 days of notice", "Before possession", "24% per annum")
- isCalendarDate: true if a fixed calendar date (e.g. 20/09/2012), false if conditional/duration
- excerpt: Exact quoted sentence from the text
- pageNumber: Source page number where it appears
- confidence: "HIGH", "MEDIUM", or "LOW"

Return strictly valid JSON:
{
  "obligations": [
    {
      "category": "string",
      "description": "string",
      "responsibleParty": "string",
      "dueDateOrPeriod": "string",
      "isCalendarDate": false,
      "excerpt": "string",
      "pageNumber": 1,
      "confidence": "HIGH | MEDIUM | LOW"
    }
  ]
}`;

        const completion = await this.groqClient.chat.completions.create({
          model: modelId,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Contract Text:\n${contractText.slice(0, 30000)}` },
          ],
          temperature: 0.1,
          max_tokens: 2000,
        });

        const rawJson = completion.choices[0]?.message?.content || '{}';
        const parsed = extractJsonFromText(rawJson);
        const obligations: ObligationResult[] = parsed?.obligations || (Array.isArray(parsed) ? parsed : []);
        if (Array.isArray(obligations) && obligations.length > 0) {
          for (const ob of obligations) {
            if (ob.excerpt && (!ob.pageNumber || ob.pageNumber < 1)) {
              ob.pageNumber = RuleEngineService.findPageForExcerpt(ob.excerpt, pageMap);
            }
          }
          return obligations;
        }
      } catch (err) {
        console.warn('Groq obligation extraction failed, falling back:', err);
      }
    }

    return RuleEngineService.extractObligations(contractText);
  }

  /**
   * Document-grounded Q&A chatbot response with exact citations using Groq Llama 3.3 70B or fallback.
   */
  static async answerQuestion(
    question: string,
    chunks: Array<{ chunkIndex: number; pageNumber: number; content: string }>,
    conversationHistory: Array<{ role: string; content: string }> = []
  ): Promise<ChatAnswerResult> {
    const status = this.getProviderStatus();

    // Score chunks to provide retrieval context
    const STOPWORDS = new Set([
      'what', 'when', 'where', 'which', 'who', 'whom', 'whose', 'why', 'how',
      'the', 'this', 'that', 'these', 'those', 'is', 'are', 'was', 'were', 'be',
      'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'and', 'but',
      'if', 'or', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for',
      'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before',
      'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on',
      'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there',
      'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
      'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just',
      'should', 'now', 'काय', 'आहे', 'का', 'कधी', 'कुठे', 'कसे'
    ]);

    const allTokens = question.toLowerCase().replace(/[^a-z0-9\u0900-\u097F\s]/g, ' ').split(/\s+/).filter((t) => t.length >= 2);
    const meaningfulTokens = allTokens.filter((t) => !STOPWORDS.has(t));
    const queryTokens = meaningfulTokens.length > 0 ? meaningfulTokens : allTokens;

    const scoredChunks = chunks.map((chunk) => {
      const contentLower = chunk.content.toLowerCase();
      let matchCount = 0;
      for (const tok of queryTokens) {
        if (contentLower.includes(tok)) matchCount += 1;
      }
      return {
        ...chunk,
        matchCount,
        score: matchCount / (queryTokens.length || 1),
      };
    });

    scoredChunks.sort((a, b) => b.score - a.score || b.matchCount - a.matchCount);

    // Pick chunks: any with score > 0, up to 4; if contract is small (<= 4 chunks total), provide all chunks
    let topChunks = scoredChunks.filter((c) => c.matchCount > 0).slice(0, 4);
    if (topChunks.length === 0 && chunks.length <= 4) {
      topChunks = chunks.map((c) => ({ ...c, matchCount: 0, score: 0.5 }));
    }

    const contextPassages = topChunks
      .map((c) => `[Source Page ${c.pageNumber}]:\n"${c.content}"`)
      .join('\n\n');

    // 1. Try Groq Llama 3.3 70B
    if (status.activeProvider === 'groq' && this.groqClient) {
      try {
        const modelId = resolveGroqModel(LLM_MODEL);
        const systemPrompt = `You are Legal Buddy, an AI-powered contract intelligence assistant.
Answer the user's question about the uploaded contract STRICTLY based on the provided retrieved passages below.

CRITICAL LEGAL SAFEGUARDS:
1. Ground your answer in the provided context passages. Cite the exact Page Number.
2. If the answer cannot be found in the provided passages, clearly state: "This information was not found in the uploaded document." Do NOT invent terms or citations.
3. Distinguish document facts from general legal considerations.
4. Do not offer definitive legal advice or guarantee validity.`;

        const userMessage = `User Question: "${question}"

Retrieved Document Context:
${contextPassages || 'No matching sections detected in document.'}

Provide your grounded response now:`;

        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
          { role: 'system', content: systemPrompt },
        ];

        // Append recent conversation context
        if (conversationHistory.length > 0) {
          for (const msg of conversationHistory.slice(-4)) {
            messages.push({
              role: msg.role === 'user' ? 'user' : 'assistant',
              content: msg.content,
            });
          }
        }

        messages.push({ role: 'user', content: userMessage });

        const completion = await this.groqClient.chat.completions.create({
          model: modelId,
          messages,
          temperature: 0.15,
          max_tokens: 1500,
        });

        const answerText = completion.choices[0]?.message?.content || '';

        return {
          answer: answerText,
          citations: topChunks.map((c) => ({
            excerpt: c.content.slice(0, 250) + '...',
            pageNumber: c.pageNumber,
            score: Math.round(c.score * 100) / 100,
          })),
          isDocumentGrounded: topChunks.length > 0,
          provider: `neural_ai (${modelId})`,
        };
      } catch (err) {
        console.warn('Groq chat failed, falling back:', err);
      }
    }

    // 2. Try Gemini
    if (status.activeProvider === 'gemini' && this.geminiClient) {
      try {
        const model = this.geminiClient.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const prompt = `You are Legal Buddy, an AI-powered contract intelligence assistant.
Answer the user's question about the uploaded contract STRICTLY based on the provided retrieved passages below.

CRITICAL LEGAL SAFEGUARDS:
1. Ground your answer in the provided context passages. Cite the exact Page Number.
2. If the answer cannot be found in the provided passages, clearly state: "This information was not found in the uploaded document." Do NOT invent terms or citations.
3. Distinguish document facts from general legal considerations.
4. Do not offer definitive legal advice or guarantee validity.

User Question: "${question}"

Retrieved Document Context:
${contextPassages || 'No matching sections detected in document.'}

Provide your grounded response now:`;

        const response = await model.generateContent(prompt);
        const answerText = response.response.text();

        return {
          answer: answerText,
          citations: topChunks.map((c) => ({
            excerpt: c.content.slice(0, 250) + '...',
            pageNumber: c.pageNumber,
            score: Math.round(c.score * 100) / 100,
          })),
          isDocumentGrounded: topChunks.length > 0,
          provider: 'gemini',
        };
      } catch (err) {
        console.warn('Gemini chat failed, falling back to rule engine:', err);
      }
    }

    // 3. Fallback to deterministic rule engine
    return RuleEngineService.answerQuestion(question, chunks);
  }
}

// Initialize on module load
AIAdapter.init();
