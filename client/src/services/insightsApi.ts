import { request } from './connectApi.js';
import type {
  DocumentInsights, CompareResult, ObligationReminder, ClauseReviewComment, ReviewClause, DocumentLawyerComment, EvaluationSummary,
} from '../types/insights.js';

const id = (v: string) => encodeURIComponent(v);
const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

export interface ReviewPayload { clauses: ReviewClause[]; comments: ClauseReviewComment[]; reviewOpen?: boolean }

export const InsightsApi = {
  insights: (documentId: string) => request<DocumentInsights>(`/documents/${id(documentId)}/insights`),
  compare: (documentId: string, templateId: string) => request<CompareResult>(`/documents/${id(documentId)}/compare?templateId=${id(templateId)}`),
  translate: (documentId: string, target: 'hi' | 'mr', kind: 'summary' | 'clause', clauseId?: string) =>
    request<{ text: string; notice: string; provider: string }>(`/documents/${id(documentId)}/translate`, json('POST', { target, kind, ...(clauseId ? { clauseId } : {}) })),

  reminders: (documentId: string) => request<{ reminders: ObligationReminder[] }>(`/documents/${id(documentId)}/obligations/reminders`),
  setReminder: (documentId: string, obligationId: string, remindOn: string, note?: string) =>
    request<{ reminder: ObligationReminder; message: string }>(`/documents/${id(documentId)}/obligations/${id(obligationId)}/reminder`, json('PUT', { remindOn, note: note || null })),
  deleteReminder: (documentId: string, obligationId: string) =>
    request<{ message: string }>(`/documents/${id(documentId)}/obligations/${id(obligationId)}/reminder`, { method: 'DELETE' }),

  /** Downloads the .ics with the auth header (a plain link cannot send the bearer token). */
  async downloadCalendar(documentId: string): Promise<number> {
    const response = await fetch(`/api/documents/${id(documentId)}/obligations/calendar.ics`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('legal_buddy_token') || ''}` },
    });
    if (!response.ok) throw new Error('Could not create the calendar file.');
    const count = Number(response.headers.get('X-Event-Count') || 0);
    const blob = await response.blob();
    const name = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') || '')?.[1] || 'obligations.ics';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return count;
  },

  documentLawyerReviews: (documentId: string) => request<{ comments: DocumentLawyerComment[] }>(`/documents/${id(documentId)}/lawyer-reviews`),
  lawyerReview: (consultationId: string) => request<ReviewPayload>(`/lawyer-portal/consultations/${id(consultationId)}/review`),
  lawyerAddReview: (consultationId: string, data: { clauseFindingId: string; verdict: string; comment: string; suggestedText?: string }) =>
    request<ReviewPayload>(`/lawyer-portal/consultations/${id(consultationId)}/review`, json('POST', data)),
  userReview: (consultationId: string) => request<ReviewPayload>(`/consultations/${id(consultationId)}/review`),
  userReply: (consultationId: string, clauseFindingId: string, comment: string) =>
    request<ReviewPayload>(`/consultations/${id(consultationId)}/review`, json('POST', { clauseFindingId, comment })),

  evaluationSummary: () => request<EvaluationSummary>('/evaluations/summary'),
};
