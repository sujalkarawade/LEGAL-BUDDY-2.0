import {
  User,
  DocumentRecord,
  ContractSummary,
  ClauseFinding,
  CompletenessCheck,
  ExtractedObligation,
  ChatMessage,
  ChatCitation,
  DocumentTemplate,
  GeneratedDocument,
  DashboardStats,
  DocumentOcrResult,
  PageOcrMetadata,
} from '../types/index.js';

const API_BASE = '/api';

class ApiService {
  private static getToken(): string | null {
    return localStorage.getItem('legal_buddy_token');
  }

  private static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorMessage = 'An error occurred during the request.';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch (e) {
        errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  // Auth
  static async login(email: string, password: string):Promise<{ user: User; token: string }> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  static async register(data: { email: string; password: string; name: string; organization?: string }): Promise<{ user: User; token: string }> {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static async getMe(): Promise<{ user: User }> {
    return this.request('/auth/me');
  }

  // Dashboard
  static async getDashboardStats(): Promise<DashboardStats> {
    return this.request('/dashboard/stats');
  }

  static async getSystemStatus(): Promise<any> {
    return this.request('/dashboard/status');
  }

  // Documents
  static async uploadDocument(
    file: File,
    sync: boolean = false
  ): Promise<{
    document: DocumentRecord;
    message: string;
    jobId?: string;
    status?: string;
    progress?: any;
  }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.request(`/documents/upload${sync ? '?sync=true' : ''}`, {
      method: 'POST',
      body: formData,
    });
  }

  static async getJobStatus(jobId: string): Promise<{
    jobId: string;
    documentId: string;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    progress: {
      completedPages: number;
      totalPages: number;
      percent: number;
      currentStage: string;
      scannedPagesCount?: number;
      selectablePagesCount?: number;
    };
    error?: string | null;
    completedAt?: string;
    document?: DocumentRecord;
  }> {
    return this.request(`/documents/jobs/${jobId}`);
  }

  static async getDocuments(): Promise<{ documents: DocumentRecord[] }> {
    return this.request('/documents');
  }

  static async getDocumentById(id: string): Promise<{ document: DocumentRecord }> {
    return this.request(`/documents/${id}`);
  }

  static async deleteDocument(id: string): Promise<{ message: string }> {
    return this.request(`/documents/${id}`, {
      method: 'DELETE',
    });
  }

  // Summary
  static async getSummary(documentId: string): Promise<{ summary: ContractSummary }> {
    return this.request(`/documents/${documentId}/summary`);
  }

  static async reanalyzeSummary(documentId: string): Promise<{ summary: ContractSummary }> {
    return this.request(`/documents/${documentId}/summary/reanalyze`, {
      method: 'POST',
    });
  }

  // OCR Preview & Text Verification
  static async getOcrPreview(documentId: string): Promise<{
    documentId: string;
    originalName: string;
    pageCount: number;
    status: string;
    ocrStatus: string;
    errorMessage?: string;
    ocrMetadata: DocumentOcrResult;
  }> {
    return this.request(`/documents/${documentId}/ocr-preview`);
  }

  static async verifyOcrAndAnalyze(
    documentId: string,
    pages: Array<{ pageNumber: number; text: string }>
  ): Promise<{ message: string; document: DocumentRecord }> {
    return this.request(`/documents/${documentId}/ocr-preview/verify`, {
      method: 'POST',
      body: JSON.stringify({ pages }),
    });
  }

  static async reOcrDocument(documentId: string): Promise<{ message: string; document: DocumentRecord }> {
    return this.request(`/documents/${documentId}/ocr-preview/re-ocr`, {
      method: 'POST',
    });
  }

  // Clauses
  static async getClauses(documentId: string, category?: string, risk?: string): Promise<{ clauses: ClauseFinding[] }> {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (risk) params.append('risk', risk);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/documents/${documentId}/clauses${queryString}`);
  }

  static async updateClauseStatus(documentId: string, clauseId: string, reviewStatus: string): Promise<{ clause: ClauseFinding }> {
    return this.request(`/documents/${documentId}/clauses/${clauseId}`, {
      method: 'PATCH',
      body: JSON.stringify({ reviewStatus }),
    });
  }

  // Completeness
  static async getCompleteness(documentId: string): Promise<{ checks: CompletenessCheck[] }> {
    return this.request(`/documents/${documentId}/completeness`);
  }

  static async toggleCompletenessReview(documentId: string, checkId: string, isReviewed: boolean): Promise<{ check: CompletenessCheck }> {
    return this.request(`/documents/${documentId}/completeness/${checkId}`, {
      method: 'PATCH',
      body: JSON.stringify({ isReviewed }),
    });
  }

  // Obligations
  static async getObligations(documentId: string): Promise<{ obligations: ExtractedObligation[] }> {
    return this.request(`/documents/${documentId}/obligations`);
  }

  static async updateObligationStatus(documentId: string, obligationId: string, reviewStatus: string): Promise<{ obligation: ExtractedObligation }> {
    return this.request(`/documents/${documentId}/obligations/${obligationId}`, {
      method: 'PATCH',
      body: JSON.stringify({ reviewStatus }),
    });
  }

  // Chatbot
  static async getChat(documentId: string): Promise<{ conversation: { id: string; messages: ChatMessage[] } }> {
    return this.request(`/documents/${documentId}/chat`);
  }

  static async sendChatMessage(documentId: string, question: string): Promise<{
    message: ChatMessage;
    citations: ChatCitation[];
    isDocumentGrounded: boolean;
    provider: string;
  }> {
    return this.request(`/documents/${documentId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ question }),
    });
  }

  static async clearChat(documentId: string): Promise<{ message: string }> {
    return this.request(`/documents/${documentId}/chat`, {
      method: 'DELETE',
    });
  }

  // Templates & Generator
  static async getTemplates(): Promise<{ templates: DocumentTemplate[] }> {
    return this.request('/templates');
  }

  static async getTemplateById(id: string): Promise<{ template: DocumentTemplate }> {
    return this.request(`/templates/${id}`);
  }

  static async generateDocument(data: { templateId: string; customTitle?: string; formData: Record<string, any> }): Promise<{
    message: string;
    generatedDocument: GeneratedDocument;
  }> {
    return this.request('/document-generator/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static async getGeneratedDrafts(): Promise<{ generatedDocuments: GeneratedDocument[] }> {
    return this.request('/document-generator/history');
  }
}

export default ApiService;
