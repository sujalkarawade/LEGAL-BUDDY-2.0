import type {
  PublicLawyer, SearchFilters, Specialization, GeocodeResult, OwnLawyerProfile, UserConsultation, LawyerConsultation,
  AppNotification, LawyerMatchResult, AdminLawyerRow, AdminStats, AdminReport, AuditEntry, ConsultationStatus, AvailabilitySlot,
} from '../types/connect.js';
import type { User } from '../types/index.js';

const API_BASE = '/api';
const token = () => localStorage.getItem('legal_buddy_token');

export async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  const t = token();
  if (t) headers.Authorization = `Bearer ${t}`;
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try { const body = await response.json(); message = body.error || body.message || message; } catch { /* non-JSON error */ }
    throw new Error(message);
  }
  return response.json();
}

const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

/** Opens an authenticated private file (credential, shared PDF) in a new tab without putting the token in a URL. */
export async function openAuthenticatedFile(endpoint: string): Promise<void> {
  const tab = window.open('about:blank', '_blank');
  if (tab) tab.opener = null;
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, { headers: { Authorization: `Bearer ${token() || ''}` } });
    if (!response.ok) throw new Error('This file is not available.');
    const url = URL.createObjectURL(await response.blob());
    if (!tab) throw new Error('Allow pop-ups to view the file.');
    tab.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 300000);
  } catch (error) {
    tab?.close();
    throw error;
  }
}

/** Loads an authenticated image as an object URL (caller must revoke it). */
export async function fetchAuthenticatedImage(endpoint: string): Promise<string | null> {
  const response = await fetch(`${API_BASE}${endpoint}`, { headers: { Authorization: `Bearer ${token() || ''}` } });
  if (!response.ok) return null;
  return URL.createObjectURL(await response.blob());
}

export const publicPhotoUrl = (lawyerId: string) => `${API_BASE}/lawyers/${encodeURIComponent(lawyerId)}/photo`;

export interface NearbyResponse {
  lawyers: PublicLawyer[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export const ConnectApi = {
  // Auth
  registerLawyer: (data: { name: string; email: string; password: string; barCouncilState: string; enrollmentNumber: string }) =>
    request<{ user: User; token: string; message: string }>('/auth/register-lawyer', json('POST', data)),

  // Discovery
  getSpecializations: () => request<{ specializations: Specialization[]; radiiKm: number[]; languages: string[] }>('/lawyers/specializations'),
  searchNearby: (lat: number, lng: number, filters: SearchFilters, page = 1) => {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng), radiusKm: String(filters.radiusKm), sort: filters.sort, verification: filters.verification, page: String(page), pageSize: '50' });
    if (filters.specialization) params.set('specialization', filters.specialization);
    if (filters.experience) params.set('experience', filters.experience);
    if (filters.mode) params.set('mode', filters.mode);
    if (filters.language) params.set('language', filters.language);
    if (filters.availability) params.set('availability', filters.availability);
    return request<NearbyResponse>(`/lawyers/nearby?${params.toString()}`);
  },
  getLawyer: (id: string) => request<{ lawyer: PublicLawyer }>(`/lawyers/${encodeURIComponent(id)}`),
  reportLawyer: (id: string, reason: string, details: string) => request<{ message: string }>(`/lawyers/${encodeURIComponent(id)}/report`, json('POST', { reason, details })),

  // Geocoding (server-side proxy; submit-only, never autocomplete)
  geoStatus: () => request<{ geocodingEnabled: boolean }>('/geo/status'),
  geocode: (q: string) => request<{ results: GeocodeResult[]; attribution: string }>(`/geo/search?q=${encodeURIComponent(q)}`),

  // Consultations (user)
  createConsultation: (data: Record<string, unknown>) => request<{ consultation: UserConsultation; message: string }>('/consultations', json('POST', data)),
  myConsultations: () => request<{ consultations: UserConsultation[] }>('/consultations'),
  actOnMyConsultation: (id: string, data: { action: string; preferredDate?: string; preferredTime?: string; message?: string }) =>
    request<{ consultation: UserConsultation }>(`/consultations/${encodeURIComponent(id)}`, json('PATCH', data)),

  // Lawyer portal
  myLawyerProfile: () => request<{ profile: OwnLawyerProfile; consultationCounts: Record<ConsultationStatus, number> }>('/lawyer-portal/profile'),
  updateLawyerProfile: (data: Record<string, unknown>) => request<{ profile: OwnLawyerProfile; message: string }>('/lawyer-portal/profile', json('PUT', data)),
  updateOffice: (data: Record<string, unknown>) => request<{ profile: OwnLawyerProfile; message: string }>('/lawyer-portal/office', json('PUT', data)),
  updateAvailability: (slots: AvailabilitySlot[]) => request<{ profile: OwnLawyerProfile; message: string }>('/lawyer-portal/availability', json('PUT', { slots })),
  uploadCredential: (file: File, kind: string) => {
    const form = new FormData();
    form.append('kind', kind); // text field first so it is parsed before the file
    form.append('file', file);
    return request<{ profile: OwnLawyerProfile; message: string }>('/lawyer-portal/credentials', { method: 'POST', body: form });
  },
  deleteCredential: (id: string) => request<{ profile: OwnLawyerProfile; message: string }>(`/lawyer-portal/credentials/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  openOwnCredential: (id: string) => openAuthenticatedFile(`/lawyer-portal/credentials/${encodeURIComponent(id)}`),
  uploadPhoto: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<{ profile: OwnLawyerProfile; message: string }>('/lawyer-portal/photo', { method: 'POST', body: form });
  },
  ownPhoto: () => fetchAuthenticatedImage('/lawyer-portal/photo'),
  submitForReview: () => request<{ profile: OwnLawyerProfile; message: string }>('/lawyer-portal/submit', { method: 'POST' }),
  lawyerConsultations: (status?: string) => request<{ consultations: LawyerConsultation[] }>(`/lawyer-portal/consultations${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  actOnLawyerConsultation: (id: string, data: { action: string; proposedDate?: string; proposedTime?: string; message?: string }) =>
    request<{ consultation: LawyerConsultation }>(`/lawyer-portal/consultations/${encodeURIComponent(id)}`, json('PATCH', data)),
  openSharedDocument: (id: string) => openAuthenticatedFile(`/lawyer-portal/consultations/${encodeURIComponent(id)}/document`),

  // Notifications
  notifications: () => request<{ notifications: AppNotification[]; unreadCount: number }>('/notifications'),
  markNotificationRead: (id: string) => request<{ updated: number }>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => request<{ updated: number }>('/notifications/read-all', { method: 'POST' }),

  // AI matching
  lawyerMatch: (documentId: string) => request<LawyerMatchResult>(`/documents/${encodeURIComponent(documentId)}/lawyer-match`),

  // Admin
  adminStats: () => request<AdminStats>('/admin/connect/stats'),
  adminLawyers: (status?: string, q?: string, page = 1) => {
    const params = new URLSearchParams({ page: String(page) });
    if (status) params.set('status', status);
    if (q) params.set('q', q);
    return request<{ lawyers: AdminLawyerRow[]; pagination: { page: number; total: number; totalPages: number } }>(`/admin/connect/lawyers?${params.toString()}`);
  },
  adminLawyer: (id: string) => request<{ lawyer: any; history: AuditEntry[] }>(`/admin/connect/lawyers/${encodeURIComponent(id)}`),
  adminDecision: (id: string, data: { action: string; reason?: string; credentialsReviewed?: boolean }) =>
    request<{ message: string; status: string }>(`/admin/connect/lawyers/${encodeURIComponent(id)}/decision`, json('POST', data)),
  adminOpenCredential: (lawyerId: string, credentialId: string) =>
    openAuthenticatedFile(`/admin/connect/lawyers/${encodeURIComponent(lawyerId)}/credentials/${encodeURIComponent(credentialId)}`),
  adminPhoto: (lawyerId: string) => fetchAuthenticatedImage(`/admin/connect/lawyers/${encodeURIComponent(lawyerId)}/photo`),
  adminReports: (status = 'OPEN') => request<{ reports: AdminReport[] }>(`/admin/connect/reports?status=${encodeURIComponent(status)}`),
  adminResolveReport: (id: string, status: 'RESOLVED' | 'DISMISSED', resolution: string) =>
    request<{ message: string }>(`/admin/connect/reports/${encodeURIComponent(id)}`, json('PATCH', { status, resolution })),
  adminSpecializations: () => request<{ specializations: Array<Specialization & { isActive: boolean; sortOrder: number; lawyerCount: number }> }>('/admin/connect/specializations'),
  adminCreateSpecialization: (name: string) => request<{ specialization: Specialization }>('/admin/connect/specializations', json('POST', { name })),
  adminUpdateSpecialization: (id: string, data: { name?: string; isActive?: boolean }) =>
    request<{ specialization: Specialization }>(`/admin/connect/specializations/${encodeURIComponent(id)}`, json('PATCH', data)),
};
