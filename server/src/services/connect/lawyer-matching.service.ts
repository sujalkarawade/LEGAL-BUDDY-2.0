/**
 * AI lawyer-specialization matching (Phase 3).
 *
 * Reuses the output that Legal Buddy's existing analysis pipeline has ALREADY stored
 * (ClauseFinding.category / riskLevel, ContractSummary.contractType, CompletenessCheck
 * NOT_FOUND sections). It is deterministic: no LLM call, no new chatbot, and no contract
 * text, excerpt or chunk is read or returned — only category labels and counts.
 *
 * Suggestions are explanations of WHY a practice area may be relevant, never a legal
 * judgment, and never a ranking of individual lawyers.
 */

export interface MatchingSignals {
  clauses: Array<{ category: string; riskLevel: string }>;
  contractType: string | null;
  missingSections: string[];
}

export interface SpecializationSuggestion {
  slug: string;
  score: number;
  reasons: string[];
}

export interface MatchResult {
  suggestions: SpecializationSuggestion[];
  detectedIssues: Array<{ category: string; highRisk: number; needsReview: number; medium: number }>;
  unclear: boolean;
  message: string;
  disclaimer: string;
}

const RISK_WEIGHT: Record<string, number> = { High: 3, 'Needs Review': 2, Medium: 1, Low: 0 };

/** Clause category (from rule-engine.ts) → relevant practice areas and a plain-language issue label. */
export const CATEGORY_MAP: Record<string, { slugs: string[]; issue: string }> = {
  Liability: { slugs: ['contract-law', 'corporate-law'], issue: 'liability and indemnity exposure' },
  Payment: { slugs: ['contract-law'], issue: 'payment terms and default risk' },
  Termination: { slugs: ['contract-law'], issue: 'termination rights and notice' },
  Confidentiality: { slugs: ['contract-law', 'intellectual-property-law'], issue: 'confidentiality protections' },
  'Intellectual Property': { slugs: ['intellectual-property-law'], issue: 'intellectual property ownership or licensing' },
  'Dispute Resolution': { slugs: ['arbitration-dispute-resolution'], issue: 'dispute resolution / arbitration terms' },
  'Governing Law': { slugs: ['arbitration-dispute-resolution', 'contract-law'], issue: 'governing law and jurisdiction' },
  Renewal: { slugs: ['contract-law'], issue: 'renewal and expiry terms' },
  Penalties: { slugs: ['contract-law'], issue: 'penalty or liquidated damages terms' },
  'Data Protection': { slugs: ['cyber-law'], issue: 'data protection obligations' },
};

const CONTRACT_TYPE_RULES: Array<{ pattern: RegExp; slugs: string[]; issue: string }> = [
  { pattern: /employ|offer letter|appointment|labou?r/i, slugs: ['employment-labour-law'], issue: 'an employment-related agreement' },
  { pattern: /\blease\b|\brent(al)?\b|leave and licen[cs]e|sale deed|\bproperty\b|real estate|tenan/i, slugs: ['property-real-estate-law'], issue: 'a property or tenancy agreement' },
  { pattern: /software|\bsaas\b|licen[cs]e|technology|data processing/i, slugs: ['intellectual-property-law', 'cyber-law'], issue: 'a technology or licensing agreement' },
  { pattern: /non-?disclosure|\bnda\b|confidentiality agreement/i, slugs: ['contract-law', 'intellectual-property-law'], issue: 'a confidentiality agreement' },
  { pattern: /shareholder|share purchase|joint venture|partnership deed|investment|merger/i, slugs: ['corporate-law'], issue: 'a corporate or investment agreement' },
  { pattern: /services? agreement|\bmsa\b|supply|vendor|consult/i, slugs: ['contract-law', 'corporate-law'], issue: 'a commercial services agreement' },
];

const MISSING_SECTION_RULES: Array<{ pattern: RegExp; slugs: string[]; issue: string }> = [
  { pattern: /confidential/i, slugs: ['contract-law'], issue: 'missing confidentiality protections' },
  { pattern: /liabilit|indemn/i, slugs: ['contract-law'], issue: 'missing liability or indemnity terms' },
  { pattern: /dispute|arbitrat/i, slugs: ['arbitration-dispute-resolution'], issue: 'missing dispute resolution terms' },
  { pattern: /governing law|jurisdiction/i, slugs: ['arbitration-dispute-resolution'], issue: 'missing governing law clause' },
  { pattern: /intellectual|\bip\b/i, slugs: ['intellectual-property-law'], issue: 'missing intellectual property terms' },
  { pattern: /data|privacy/i, slugs: ['cyber-law'], issue: 'missing data protection terms' },
  { pattern: /terminat/i, slugs: ['contract-law'], issue: 'missing termination terms' },
  { pattern: /payment/i, slugs: ['contract-law'], issue: 'missing payment terms' },
];

export const MATCH_DISCLAIMER =
  'These suggestions are generated from Legal Buddy\'s automated clause analysis and are not legal advice. '
  + 'They indicate practice areas that may be relevant; they do not assess or rank any individual lawyer. '
  + 'Your document is not shared with anyone unless you explicitly choose to attach it to a consultation request.';

export function suggestSpecializations(signals: MatchingSignals): MatchResult {
  const scores = new Map<string, { score: number; reasons: Set<string> }>();
  const add = (slug: string, score: number, reason: string) => {
    const entry = scores.get(slug) || { score: 0, reasons: new Set<string>() };
    entry.score += score;
    entry.reasons.add(reason);
    scores.set(slug, entry);
  };

  const byCategory = new Map<string, { highRisk: number; needsReview: number; medium: number; weight: number }>();
  for (const clause of signals.clauses) {
    const weight = RISK_WEIGHT[clause.riskLevel] ?? 0;
    if (!CATEGORY_MAP[clause.category]) continue;
    const entry = byCategory.get(clause.category) || { highRisk: 0, needsReview: 0, medium: 0, weight: 0 };
    if (clause.riskLevel === 'High') entry.highRisk += 1;
    if (clause.riskLevel === 'Needs Review') entry.needsReview += 1;
    if (clause.riskLevel === 'Medium') entry.medium += 1;
    entry.weight += weight;
    byCategory.set(clause.category, entry);
  }

  for (const [category, entry] of byCategory) {
    if (entry.weight === 0) continue; // low-risk clauses alone never drive a recommendation
    const map = CATEGORY_MAP[category];
    const parts = [
      entry.highRisk ? `${entry.highRisk} high-risk` : '',
      entry.needsReview ? `${entry.needsReview} needing review` : '',
      entry.medium ? `${entry.medium} medium-risk` : '',
    ].filter(Boolean).join(', ');
    for (const slug of map.slugs) add(slug, entry.weight, `${category} clauses (${parts}) suggest ${map.issue}.`);
  }

  for (const section of signals.missingSections) {
    const rule = MISSING_SECTION_RULES.find(r => r.pattern.test(section));
    if (rule) for (const slug of rule.slugs) add(slug, 1, `Completeness check: ${rule.issue} ("${section.slice(0, 80)}").`);
  }

  // Contract type only adds context to an existing signal or provides a weak signal on its own.
  if (signals.contractType) {
    const rule = CONTRACT_TYPE_RULES.find(r => r.pattern.test(signals.contractType || ''));
    if (rule) for (const slug of rule.slugs) add(slug, 1, `The document appears to be ${rule.issue}.`);
  }

  const suggestions = [...scores.entries()]
    .map(([slug, v]) => ({ slug, score: v.score, reasons: [...v.reasons].slice(0, 4) }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug))
    .slice(0, 3);

  const detectedIssues = [...byCategory.entries()]
    .filter(([, v]) => v.weight > 0)
    .map(([category, v]) => ({ category, highRisk: v.highRisk, needsReview: v.needsReview, medium: v.medium }));

  const unclear = suggestions.length === 0;
  return {
    suggestions,
    detectedIssues,
    unclear,
    message: unclear
      ? 'The analysis did not identify issues that clearly point to a specific practice area. You can still search all available lawyers manually.'
      : 'Based on the analysed clauses, these practice areas may be relevant. You can ignore these suggestions and search manually.',
    disclaimer: MATCH_DISCLAIMER,
  };
}
