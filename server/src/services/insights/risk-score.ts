import type { ComplianceFinding } from './indian-law-checks.js';

/**
 * Transparent, rule-based contract risk indicator (0 = few signals, 100 = many serious signals).
 * Every point is traceable to a stored finding, so the panel/user can see exactly why a score
 * is what it is. It is a triage aid, not a legal assessment of the contract.
 */

export const RISK_WEIGHTS = {
  clause: { High: 15, 'Needs Review': 8, Medium: 6, Low: 0 } as Record<string, number>,
  completeness: { NOT_FOUND: 5, NEEDS_REVIEW: 2, FOUND: 0 } as Record<string, number>,
  compliance: { IMPORTANT: 10, REVIEW: 5, INFO: 1 } as Record<string, number>,
  caps: { clauses: 50, completeness: 25, compliance: 25 },
};

export interface RiskInput {
  clauses: Array<{ category: string; title: string; riskLevel: string }>;
  completeness: Array<{ expectedSection: string; status: string }>;
  compliance: Array<Pick<ComplianceFinding, 'ruleId' | 'title' | 'severity'>>;
}

export interface RiskContribution { source: 'Clause analysis' | 'Completeness' | 'Indian law checks'; label: string; points: number }

export interface RiskScore {
  score: number;
  band: 'Low' | 'Moderate' | 'High' | 'Very high';
  components: { clauses: number; completeness: number; compliance: number };
  contributions: RiskContribution[];
  method: string;
  disclaimer: string;
}

export function bandFor(score: number): RiskScore['band'] {
  if (score >= 75) return 'Very high';
  if (score >= 50) return 'High';
  if (score >= 25) return 'Moderate';
  return 'Low';
}

export function computeRiskScore(input: RiskInput): RiskScore {
  const contributions: RiskContribution[] = [];

  let clauses = 0;
  for (const c of input.clauses) {
    const p = RISK_WEIGHTS.clause[c.riskLevel] ?? 0;
    if (p > 0) { clauses += p; contributions.push({ source: 'Clause analysis', label: `${c.title} (${c.riskLevel} risk)`, points: p }); }
  }
  let completeness = 0;
  for (const c of input.completeness) {
    const p = RISK_WEIGHTS.completeness[c.status] ?? 0;
    if (p > 0) {
      completeness += p;
      contributions.push({ source: 'Completeness', label: `${c.expectedSection} ${c.status === 'NOT_FOUND' ? 'not found' : 'needs review'}`, points: p });
    }
  }
  let compliance = 0;
  for (const f of input.compliance) {
    const p = RISK_WEIGHTS.compliance[f.severity] ?? 0;
    if (p > 0) { compliance += p; contributions.push({ source: 'Indian law checks', label: f.title, points: p }); }
  }

  const components = {
    clauses: Math.min(clauses, RISK_WEIGHTS.caps.clauses),
    completeness: Math.min(completeness, RISK_WEIGHTS.caps.completeness),
    compliance: Math.min(compliance, RISK_WEIGHTS.caps.compliance),
  };
  const score = Math.min(100, components.clauses + components.completeness + components.compliance);

  return {
    score,
    band: bandFor(score),
    components,
    contributions: contributions.sort((a, b) => b.points - a.points),
    method: `Clause risk: High ${RISK_WEIGHTS.clause.High}, Needs Review ${RISK_WEIGHTS.clause['Needs Review']}, Medium ${RISK_WEIGHTS.clause.Medium} points each (max ${RISK_WEIGHTS.caps.clauses}). `
      + `Missing section ${RISK_WEIGHTS.completeness.NOT_FOUND}, section needing review ${RISK_WEIGHTS.completeness.NEEDS_REVIEW} (max ${RISK_WEIGHTS.caps.completeness}). `
      + `Indian law flag: important ${RISK_WEIGHTS.compliance.IMPORTANT}, review ${RISK_WEIGHTS.compliance.REVIEW}, info ${RISK_WEIGHTS.compliance.INFO} (max ${RISK_WEIGHTS.caps.compliance}).`,
    disclaimer: 'A heuristic indicator built from Legal Buddy\'s automated findings. It does not measure the legal validity or commercial fairness of the contract.',
  };
}
