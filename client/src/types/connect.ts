export interface Specialization { id: string; slug: string; name: string }

export interface AvailabilitySlot { dayOfWeek: number; startTime: string; endTime: string }

export interface PublicLawyer {
  id: string;
  professionalName: string;
  professionalTitle: string | null;
  bio: string | null;
  hasPhoto: boolean;
  yearsOfExperience: number | null;
  practiceStartYear: number | null;
  languages: string[];
  education: string | null;
  barCouncilState: string;
  enrollmentNumber: string;
  enrollmentDate: string | null;
  source: 'LEGAL_BUDDY' | 'EXTERNAL_DIRECTORY';
  legalBuddyVerified: boolean;
  verifiedAt: string | null;
  isSynthetic: boolean;
  specializations: Specialization[];
  consultation: {
    offersInPerson: boolean;
    offersOnline: boolean;
    acceptingRequests: boolean;
    feeInr: number | null;
    availability: AvailabilitySlot[];
  };
  contact: { phone: string | null; email: string | null };
  office: {
    officeName: string | null;
    addressLine: string;
    locality: string | null;
    city: string;
    state: string;
    postalCode: string;
    latitude: number;
    longitude: number;
  } | null;
  distanceKm: number | null;
}

export interface SearchFilters {
  radiusKm: number;
  specialization: string;
  experience: string;
  mode: string;
  language: string;
  verification: 'VERIFIED_ONLY' | 'ALL_APPROVED';
  availability: string;
  sort: 'NEAREST' | 'EXPERIENCE' | 'RECENTLY_VERIFIED';
}

export interface SearchLocation { lat: number; lng: number; label: string }

export interface GeocodeResult {
  label: string;
  latitude: number;
  longitude: number;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  locality: string | null;
}

export type LawyerStatus = 'DRAFT' | 'PENDING_REVIEW' | 'INFO_REQUESTED' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED' | 'LISTED';

export interface Credential { id: string; kind: string; originalName: string; mimeType: string; sizeBytes: number; createdAt: string; sha256?: string }

export interface CompletionItem { key: string; label: string; required: boolean; done: boolean }

export interface OwnLawyerProfile {
  id: string;
  professionalName: string;
  professionalTitle: string | null;
  bio: string | null;
  hasPhoto: boolean;
  practiceStartYear: number | null;
  languages: string[];
  education: string | null;
  barCouncilState: string;
  enrollmentNumber: string;
  enrollmentDate: string | null;
  status: LawyerStatus;
  statusReason: string | null;
  submittedAt: string | null;
  verifiedAt: string | null;
  identityLocked: boolean;
  credentialsEditable: boolean;
  offersInPerson: boolean;
  offersOnline: boolean;
  acceptingRequests: boolean;
  feeDisclosed: boolean;
  consultationFeeInr: number | null;
  contactPhone: string | null;
  publishPhone: boolean;
  contactEmail: string | null;
  publishEmail: boolean;
  specializations: Specialization[];
  office: PublicLawyer['office'];
  availability: AvailabilitySlot[];
  credentials: Credential[];
  completion: { percent: number; items: CompletionItem[]; missingRequired: string[]; readyToSubmit: boolean };
}

export type ConsultationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'RESCHEDULE_REQUESTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

interface ConsultationBase {
  id: string;
  status: ConsultationStatus;
  mode: 'IN_PERSON' | 'ONLINE';
  specialization: Specialization | null;
  preferredDate: string;
  preferredTime: string;
  proposedDate: string | null;
  proposedTime: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  rescheduleRequestedBy: 'USER' | 'LAWYER' | null;
  lawyerMessage: string | null;
  userMessage: string | null;
  cancelledBy: 'USER' | 'LAWYER' | null;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserConsultation extends ConsultationBase {
  lawyer: { id: string; professionalName: string; professionalTitle: string | null; city: string | null; state: string | null; phone: string | null; email: string | null; isListed: boolean };
  sharedDocument: { id: string; originalName: string; sharedAt: string; revokedAt: string | null; analysisShared: boolean } | null;
}

export interface LawyerConsultation extends ConsultationBase {
  sharedDocument: { originalName: string; sharedAt: string; analysisShared: boolean } | null;
}

export interface AppNotification { id: string; type: string; title: string; body: string; link: string | null; readAt: string | null; createdAt: string }

export interface MatchSuggestion { slug: string; specializationId: string; name: string; score: number; reasons: string[] }

export interface LawyerMatchResult {
  analysed: boolean;
  suggestions: MatchSuggestion[];
  detectedIssues: Array<{ category: string; highRisk: number; needsReview: number; medium: number }>;
  unclear: boolean;
  message: string;
  disclaimer: string;
}

export interface AdminLawyerRow {
  id: string; professionalName: string; email: string; barCouncilState: string; enrollmentNumber: string;
  status: LawyerStatus; source: string; isSynthetic: boolean; city: string | null; state: string | null;
  credentialCount: number; openReports: number; submittedAt: string | null; verifiedAt: string | null; createdAt: string;
}

export interface AdminStats {
  lawyers: Record<LawyerStatus, number> & { total: number; newLast7Days: number };
  openReports: number;
  consultations: Record<ConsultationStatus, number> & { total: number };
}

export interface AdminReport {
  id: string; reason: string; details: string | null; status: string; resolution: string | null; createdAt: string;
  lawyerProfile: { id: string; professionalName: string; status: string };
  reporter: { name: string; email: string };
}

export interface AuditEntry { id: string; action: string; previousStatus: string | null; newStatus: string | null; reason: string | null; createdAt: string; admin: { name: string; email: string } }

export const BAR_COUNCILS = [
  'Andhra Pradesh', 'Assam, Nagaland, Meghalaya, Manipur, Tripura, Mizoram & Arunachal Pradesh', 'Bihar',
  'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat', 'Himachal Pradesh', 'Jammu & Kashmir and Ladakh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra & Goa', 'Odisha', 'Punjab & Haryana', 'Rajasthan',
  'Tamil Nadu & Puducherry', 'Telangana', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
] as const;

export const CREDENTIAL_KIND_LABELS: Record<string, string> = {
  ENROLLMENT_CERTIFICATE: 'Enrollment certificate',
  BAR_COUNCIL_ID: 'Bar Council ID card',
  DEGREE_CERTIFICATE: 'Law degree certificate',
  CERTIFICATE_OF_PRACTICE: 'Certificate of Practice',
  OTHER: 'Other supporting document',
};

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
