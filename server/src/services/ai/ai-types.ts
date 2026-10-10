export interface ContractSummaryResult {
  contractType: string;
  parties: string;
  purpose: string;
  effectiveDate: string;
  endDate: string;
  paymentTerms: string;
  responsibilities: string;
  terminationConditions: string;
  confidentialityTerms: string;
  liabilityTerms: string;
  renewalProvisions: string;
  importantDeadlines: string;
  missingInfo: string;
  rawSummary: string;
  analysisProvider: string;
}

export interface ClauseFindingResult {
  category: string;
  title: string;
  excerpt: string;
  pageNumber?: number;
  plainLanguageExplanation: string;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Needs Review';
  potentialConcern?: string;
  reviewQuestion?: string;
}

export interface CompletenessItemResult {
  expectedSection: string;
  detectedTitle?: string;
  status: 'FOUND' | 'NOT_FOUND' | 'NEEDS_REVIEW';
  excerpt?: string;
  pageNumber?: number;
  reason: string;
}

export interface ObligationResult {
  category: string;
  description: string;
  responsibleParty?: string;
  dueDateOrPeriod?: string;
  isCalendarDate: boolean;
  excerpt?: string;
  pageNumber?: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface ChatAnswerResult {
  answer: string;
  citations: Array<{
    excerpt: string;
    pageNumber: number;
    score: number;
  }>;
  isDocumentGrounded: boolean;
  provider: string;
}
