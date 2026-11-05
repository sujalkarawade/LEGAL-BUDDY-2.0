import { z } from 'zod';

export const LAWYER_STATUSES = ['DRAFT', 'PENDING_REVIEW', 'INFO_REQUESTED', 'VERIFIED', 'REJECTED', 'SUSPENDED', 'LISTED'] as const;
export type LawyerStatus = typeof LAWYER_STATUSES[number];

export const LAWYER_SOURCES = ['LEGAL_BUDDY', 'EXTERNAL_DIRECTORY'] as const;
export type LawyerSource = typeof LAWYER_SOURCES[number];

/** Statuses from which a lawyer may (re)submit the profile for admin review. */
export const SUBMITTABLE_STATUSES: LawyerStatus[] = ['DRAFT', 'INFO_REQUESTED', 'REJECTED'];
/** Identity fields that are frozen while under review or after verification (contact an admin to change). */
export const IDENTITY_LOCKED_STATUSES: LawyerStatus[] = ['PENDING_REVIEW', 'VERIFIED', 'SUSPENDED'];

export const CONSULTATION_STATUSES = ['PENDING', 'ACCEPTED', 'REJECTED', 'RESCHEDULE_REQUESTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as const;
export type ConsultationStatus = typeof CONSULTATION_STATUSES[number];

export const CONSULTATION_MODES = ['IN_PERSON', 'ONLINE'] as const;
export const CREDENTIAL_KINDS = ['ENROLLMENT_CERTIFICATE', 'BAR_COUNCIL_ID', 'DEGREE_CERTIFICATE', 'CERTIFICATE_OF_PRACTICE', 'OTHER'] as const;
export const REPORT_REASONS = ['INCORRECT_INFORMATION', 'IMPERSONATION', 'MISCONDUCT', 'INAPPROPRIATE_CONTENT', 'OTHER'] as const;
export const SEARCH_RADII_KM = [5, 10, 25, 50, 100] as const;
export const EXPERIENCE_BANDS = ['0-2', '3-5', '6-10', '10+'] as const;

/** State Bar Councils constituted under the Advocates Act, 1961 (some cover several states/UTs). */
export const BAR_COUNCILS = [
  'Andhra Pradesh', 'Assam, Nagaland, Meghalaya, Manipur, Tripura, Mizoram & Arunachal Pradesh', 'Bihar',
  'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat', 'Himachal Pradesh', 'Jammu & Kashmir and Ladakh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra & Goa', 'Odisha', 'Punjab & Haryana', 'Rajasthan',
  'Tamil Nadu & Puducherry', 'Telangana', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
] as const;

export const COMMON_LANGUAGES = ['English', 'Hindi', 'Marathi', 'Gujarati', 'Bengali', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Punjabi', 'Urdu', 'Odia'] as const;

/** Normalises an enrollment number for duplicate detection: "MAH/1234/2015" == "mah 1234 2015". */
export function normalizeEnrollmentNumber(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Title-cases free-text language names so filters match regardless of how they were typed. */
export function normalizeLanguage(value: string): string {
  return value.trim().toLowerCase().replace(/\b\p{L}/gu, ch => ch.toUpperCase());
}

const trimmed = (max: number) => z.string().trim().max(max);
/** Omitted → undefined (field left unchanged); empty string or null → null (field cleared). */
const optionalText = (max: number) => trimmed(max).optional().nullable()
  .transform(v => (v === undefined ? undefined : v ? v : null));
const phone = z.string().trim().regex(/^\+?[0-9][0-9\s-]{6,18}[0-9]$/, 'Please provide a valid phone number.');
export const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the YYYY-MM-DD date format.')
  .refine(v => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'Invalid date.');
export const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use the HH:MM 24-hour time format.');

export const latitude = z.coerce.number().finite().min(-90).max(90);
export const longitude = z.coerce.number().finite().min(-180).max(180);

/** Coordinates of (0,0) are almost always a failed geocode, never an Indian law office. */
export function isPlausibleCoordinate(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}

// ─── Registration ───────────────────────────────────────────────────────────
export const lawyerRegistrationSchema = z.object({
  name: z.string().trim().min(2, 'Full name is required').max(120),
  email: z.string().trim().email('Please provide a valid email address').max(200),
  password: z.string().min(8, 'Password must be at least 8 characters long').max(200),
  barCouncilState: z.enum(BAR_COUNCILS, { errorMap: () => ({ message: 'Select your State Bar Council.' }) }),
  enrollmentNumber: z.string().trim().min(3, 'Enrollment number is required').max(40)
    .refine(v => normalizeEnrollmentNumber(v).length >= 3, 'Enrollment number is required'),
}).strict();

// ─── Lawyer self-service profile (status / verification fields are NOT accepted) ──
export const lawyerProfileUpdateSchema = z.object({
  professionalName: trimmed(120).min(2).optional(),
  professionalTitle: optionalText(120),
  bio: optionalText(3000),
  practiceStartYear: z.coerce.number().int().min(1950).max(new Date().getFullYear()).optional().nullable(),
  languages: z.array(trimmed(40).min(2)).max(15).optional(),
  education: optionalText(2000),
  barCouncilState: z.enum(BAR_COUNCILS).optional(),
  enrollmentNumber: trimmed(40).min(3).optional(),
  enrollmentDate: dateString.optional().nullable(),
  offersInPerson: z.boolean().optional(),
  offersOnline: z.boolean().optional(),
  acceptingRequests: z.boolean().optional(),
  feeDisclosed: z.boolean().optional(),
  consultationFeeInr: z.coerce.number().int().min(0).max(10_000_000).optional().nullable(),
  contactPhone: phone.optional().nullable().or(z.literal('').transform(() => null)),
  publishPhone: z.boolean().optional(),
  contactEmail: z.string().trim().email('Please provide a valid email address').max(200).optional().nullable().or(z.literal('').transform(() => null)),
  publishEmail: z.boolean().optional(),
  specializationIds: z.array(z.string().uuid()).max(8).optional(),
}).strict();

export const officeSchema = z.object({
  officeName: optionalText(150),
  addressLine: trimmed(300).min(5, 'Office address is required'),
  locality: optionalText(120),
  city: trimmed(80).min(2, 'City is required'),
  state: trimmed(80).min(2, 'State is required'),
  postalCode: z.string().trim().regex(/^[1-9][0-9]{5}$/, 'Enter a valid 6-digit PIN code.'),
  latitude,
  longitude,
}).strict().refine(v => isPlausibleCoordinate(v.latitude, v.longitude), {
  message: 'Set a valid office location on the map.', path: ['latitude'],
});

export const availabilitySchema = z.object({
  slots: z.array(z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: timeString,
    endTime: timeString,
  }).strict().refine(s => s.startTime < s.endTime, 'Start time must be before end time.')).max(28),
}).strict();

// ─── Search ─────────────────────────────────────────────────────────────────
export const nearbySearchSchema = z.object({
  lat: latitude,
  lng: longitude,
  radiusKm: z.coerce.number().refine(v => (SEARCH_RADII_KM as readonly number[]).includes(v), 'Radius must be 5, 10, 25, 50 or 100 km.').default(25),
  specialization: z.string().trim().max(80).optional(),
  experience: z.enum(EXPERIENCE_BANDS).optional(),
  mode: z.enum(['IN_PERSON', 'ONLINE', 'BOTH']).optional(),
  language: z.string().trim().max(40).optional(),
  verification: z.enum(['VERIFIED_ONLY', 'ALL_APPROVED']).default('VERIFIED_ONLY'),
  availability: z.enum(['ACCEPTING', 'UNAVAILABLE']).optional(),
  sort: z.enum(['NEAREST', 'EXPERIENCE', 'RECENTLY_VERIFIED']).default('NEAREST'),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
}).refine(v => isPlausibleCoordinate(v.lat, v.lng), { message: 'Invalid search coordinates.', path: ['lat'] });
export type NearbySearchInput = z.infer<typeof nearbySearchSchema>;

// ─── Consultations ──────────────────────────────────────────────────────────
export const consultationCreateSchema = z.object({
  lawyerId: z.string().uuid(),
  contactName: trimmed(120).min(2, 'Name is required'),
  contactPhone: phone,
  contactEmail: z.string().trim().email('Please provide a valid email address').max(200),
  specializationId: z.string().uuid().optional().nullable(),
  description: trimmed(2000).min(20, 'Please describe your issue in at least 20 characters.'),
  mode: z.enum(CONSULTATION_MODES),
  preferredDate: dateString,
  preferredTime: timeString,
  sharedDocumentId: z.string().uuid().optional().nullable(),
  documentShareConsent: z.boolean().optional().default(false),
  /** Separate consent: lets the lawyer see Legal Buddy's clause findings for the shared document and comment on them. */
  analysisShareConsent: z.boolean().optional().default(false),
}).strict();

export const REVIEW_VERDICTS = ['ACCEPTABLE', 'NEEDS_CHANGE', 'COMMENT'] as const;
export const clauseReviewSchema = z.object({
  clauseFindingId: z.string().uuid(),
  verdict: z.enum(REVIEW_VERDICTS).optional().default('COMMENT'),
  comment: trimmed(2000).min(2, 'Write a comment.'),
  suggestedText: optionalText(3000),
}).strict();

export const userConsultationActionSchema = z.object({
  action: z.enum(['CONFIRM', 'REQUEST_RESCHEDULE', 'CANCEL', 'REVOKE_DOCUMENT']),
  preferredDate: dateString.optional(),
  preferredTime: timeString.optional(),
  message: optionalText(1000),
}).strict();

export const lawyerConsultationActionSchema = z.object({
  action: z.enum(['ACCEPT', 'REJECT', 'PROPOSE_TIME', 'COMPLETE', 'CANCEL']),
  proposedDate: dateString.optional(),
  proposedTime: timeString.optional(),
  message: optionalText(1000),
}).strict();

// ─── Admin ──────────────────────────────────────────────────────────────────
export const adminDecisionSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'REQUEST_INFO', 'SUSPEND', 'RESTORE']),
  reason: optionalText(2000),
  /** The admin must confirm they personally checked the credentials (no automated Bar Council check exists). */
  credentialsReviewed: z.boolean().optional().default(false),
}).strict();

export const reportCreateSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  details: optionalText(1000),
}).strict();

export const reportResolveSchema = z.object({
  status: z.enum(['RESOLVED', 'DISMISSED']),
  resolution: trimmed(1000).min(3, 'Add a short resolution note.'),
}).strict();

export const specializationCreateSchema = z.object({
  name: trimmed(80).min(3),
  sortOrder: z.number().int().min(0).max(10000).optional(),
}).strict();

export const specializationUpdateSchema = z.object({
  name: trimmed(80).min(3).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
}).strict();

export function firstZodError(error: z.ZodError): string {
  const issue = error.errors[0];
  if (!issue) return 'Invalid request.';
  if (issue.code === 'unrecognized_keys') return `Field(s) not allowed: ${issue.keys.join(', ')}.`;
  return issue.message;
}

export function slugify(name: string): string {
  return name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}
