export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  organization?: string | null;
  createdAt?: string;
  _count?: {
    documents: number;
    generatedDocs: number;
  };
}

export interface ContractSummary {
  id: string;
  documentId: string;
  contractType: string;
  parties: string;
  purpose: string;
  effectiveDate: string | null;
  endDate: string | null;
  paymentTerms: string | null;
  responsibilities: string | null;
  terminationConditions: string | null;
  confidentialityTerms: string | null;
  liabilityTerms: string | null;
  renewalProvisions: string | null;
  importantDeadlines: string | null;
  missingInfo: string | null;
  rawSummary: string | null;
  analysisProvider: string;
  createdAt: string;
}

export interface ClauseFinding {
  id: string;
  documentId: string;
  category: string;
  title: string;
  excerpt: string;
  pageNumber: number | null;
  plainLanguageExplanation: string;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Needs Review';
  potentialConcern?: string | null;
  reviewQuestion?: string | null;
  reviewStatus: 'PENDING' | 'APPROVED' | 'FLAGGED';
  createdAt: string;
}

export interface CompletenessCheck {
  id: string;
  documentId: string;
  contractCategory: string;
  expectedSection: string;
  detectedTitle?: string | null;
  status: 'FOUND' | 'NOT_FOUND' | 'NEEDS_REVIEW';
  excerpt?: string | null;
  pageNumber?: number | null;
  reason: string;
  isReviewed: boolean;
  createdAt: string;
}

export interface ExtractedObligation {
  id: string;
  documentId: string;
  category: string;
  description: string;
  responsibleParty?: string | null;
  dueDateOrPeriod?: string | null;
  isCalendarDate: boolean;
  excerpt?: string | null;
  pageNumber?: number | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reviewStatus: 'UNREVIEWED' | 'ACKNOWLEDGED' | 'DISMISSED';
  createdAt: string;
  document?: {
    id: string;
    originalName: string;
  };
}

export interface PageOcrMetadata {
  pageNumber: number;
  isScanned: boolean;
  extractionType: 'selectable' | 'paddle_ocr' | 'fallback' | 'failed';
  text: string;
  wordCount: number;
  confidence: number;
  skewAngle?: number;
  languages: string[];
  hasLowConfidence: boolean;
  uncertainWordCount: number;
  flagged: boolean;
  flaggedReason?: string;
  lineCount?: number;
}

export interface DocumentOcrResult {
  totalPages: number;
  scannedPagesCount: number;
  selectablePagesCount: number;
  overallConfidence: number;
  detectedLanguages: string[];
  pages: PageOcrMetadata[];
  fullText: string;
  hasLowConfidencePages: boolean;
  hasSkewedPages: boolean;
  ocrEngineUsed: 'paddle_ocr' | 'selectable_direct' | 'none';
  warningMessage?: string;
  isConfigured: boolean;
  isVerifiedByUser?: boolean;
}

export interface DocumentRecord {
  id: string;
  userId: string;
  originalName: string;
  storedName: string;
  fileSize: number;
  mimeType: string;
  pageCount: number;
  status: 'UPLOADED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  errorMessage?: string | null;
  ocrMetadata?: string | null;
  ocrStatus?: 'NONE' | 'PENDING_REVIEW' | 'VERIFIED' | 'OCR_COMPLETED' | 'FAILED' | null;
  ocrResult?: DocumentOcrResult;
  createdAt: string;
  updatedAt: string;
  summary?: ContractSummary | null;
  clauses?: ClauseFinding[];
  completenessChecks?: CompletenessCheck[];
  obligations?: ExtractedObligation[];
  _count?: {
    clauses: number;
    completenessChecks: number;
    obligations: number;
  };
}

export interface ChatCitation {
  excerpt: string;
  pageNumber: number;
  score: number;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sourceCitations?: string | null;
  createdAt: string;
}

export interface DocumentTemplateField {
  name: string;
  label: string;
  type: 'text' | 'date' | 'number' | 'textarea';
  required: boolean;
  placeholder?: string;
  description?: string;
}

export interface DocumentTemplate {
  id: string;
  title: string;
  category: string;
  description: string;
  schemaJson: string;
  templateText: string;
  fields?: DocumentTemplateField[];
  createdAt: string;
}

export interface GeneratedDocument {
  id: string;
  userId: string;
  templateId?: string | null;
  title: string;
  category: string;
  inputDataJson: string;
  renderedContent: string;
  docxFileName?: string | null;
  createdAt: string;
}

export interface AIProviderStatus {
  activeProvider: 'groq' | 'gemini' | 'openai' | 'rule_engine';
  isLiveLlm: boolean;
  groqConfigured: boolean;
  geminiConfigured: boolean;
  openaiConfigured: boolean;
  model?: string;
  notice: string;
}

export interface DashboardStats {
  stats: {
    totalDocs: number;
    completedDocs: number;
    totalClauses: number;
    highRiskClauses: number;
    pendingObligations: number;
    totalDrafts: number;
  };
  recentDocuments: DocumentRecord[];
  upcomingObligations: ExtractedObligation[];
  recentGeneratedDocs: GeneratedDocument[];
  aiStatus: AIProviderStatus;
}
