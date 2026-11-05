export type ComplianceSeverity = 'IMPORTANT' | 'REVIEW' | 'INFO';

export interface ComplianceFinding {
  ruleId: string;
  title: string;
  statute: string;
  provision: string;
  severity: ComplianceSeverity;
  whyFlagged: string;
  guidance: string;
  excerpt: string | null;
  pageNumber: number | null;
  specialization: string;
}

export interface RiskScore {
  score: number;
  band: 'Low' | 'Moderate' | 'High' | 'Very high';
  components: { clauses: number; completeness: number; compliance: number };
  contributions: Array<{ source: string; label: string; points: number }>;
  method: string;
  disclaimer: string;
}

export interface DocumentInsights {
  analysed: boolean;
  compliance: { findings: ComplianceFinding[]; rulesEvaluated: number; disclaimer: string } | null;
  riskScore: RiskScore | null;
  translationAvailable: boolean;
}

export interface SectionComparison {
  number: string;
  heading: string;
  status: 'PRESENT' | 'DIFFERENT_WORDING' | 'MISSING';
  coverage: number;
  headingFound: boolean;
  pageNumber: number | null;
  contractExcerpt: string | null;
  missingTerms: string[];
}

export interface CompareResult {
  template: { id: string; title: string };
  sections: SectionComparison[];
  summary: { total: number; present: number; differentWording: number; missing: number };
  method: string;
}

export interface ObligationReminder { id: string; obligationId: string; remindOn: string; note: string | null; notifiedAt?: string | null }

export interface ClauseReviewComment {
  id: string;
  clauseFindingId: string;
  authorRole: 'LAWYER' | 'USER';
  verdict: 'ACCEPTABLE' | 'NEEDS_CHANGE' | 'COMMENT';
  comment: string;
  suggestedText: string | null;
  createdAt: string;
}

export interface ReviewClause {
  id: string; category: string; title: string; excerpt: string; pageNumber: number | null; riskLevel: string;
  plainLanguageExplanation: string; potentialConcern: string | null; reviewQuestion: string | null;
}

export interface DocumentLawyerComment extends ClauseReviewComment {
  consultationId: string;
  lawyer: { id: string; professionalName: string };
}

export interface MetricRow { key: string; tp: number; fp: number; fn: number; precision: number | null; recall: number | null; f1: number | null }

export interface EvaluationSummary {
  clauseBenchmark: null | {
    executedAt: string; notice: string; cases: number; fixtureSha256: string;
    clauseDetection: { overall: MetricRow; byCategory: MetricRow[] };
    riskLevelAgreement: { compared: number; agreed: number; rate: number | null };
    indianLawChecks: { overall: MetricRow; byRule: MetricRow[] };
    fallbackGeneralSections: number;
    rows: Array<{ id: string; clauses: Array<{ category: string; result: string; expectedRisk?: string; detectedRisk?: string }>; compliance: Array<{ ruleId: string; result: string }> }>;
  };
  retrieval: null | { executedAt: string; mode: string; notice: string; cases: number; passageRetrieved: number; correctPage: number; citationValidated: number; medianRetrievalMs: number | null };
  hybridSearch: null | { executedAt: string; notice: string; modes: Array<{ mode: string; cases: number; top1Hits: number; recallAt3: number; mrrAt3: number; p50Ms: number }> };
  endToEnd: null | { executedAt: string; passed: number; total: number; failed: string[] };
  howToRefresh: Record<string, string>;
}
