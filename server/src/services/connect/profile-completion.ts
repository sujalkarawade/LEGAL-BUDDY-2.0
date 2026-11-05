export interface CompletionInput {
  professionalName: string;
  professionalTitle: string | null;
  bio: string | null;
  education: string | null;
  practiceStartYear: number | null;
  languages: string[];
  barCouncilState: string;
  enrollmentNumber: string;
  photoStoredName: string | null;
  offersInPerson: boolean;
  offersOnline: boolean;
  contactPhone: string | null;
  contactEmail: string | null;
  specializationCount: number;
  hasOffice: boolean;
  credentialCount: number;
  availabilityCount: number;
}

interface Check { key: string; label: string; required: boolean; done: (p: CompletionInput) => boolean }

const CHECKS: Check[] = [
  { key: 'identity', label: 'Name and Bar Council enrollment', required: true, done: p => Boolean(p.professionalName && p.barCouncilState && p.enrollmentNumber) },
  { key: 'experience', label: 'Year you started practising', required: true, done: p => Boolean(p.practiceStartYear) },
  { key: 'languages', label: 'At least one language', required: true, done: p => p.languages.length > 0 },
  { key: 'specializations', label: 'At least one specialization', required: true, done: p => p.specializationCount > 0 },
  { key: 'office', label: 'Office address and map location', required: true, done: p => p.hasOffice },
  { key: 'modes', label: 'In-person and/or online consultations', required: true, done: p => p.offersInPerson || p.offersOnline },
  { key: 'contact', label: 'Professional phone or email', required: true, done: p => Boolean(p.contactPhone || p.contactEmail) },
  { key: 'credentials', label: 'At least one verification document', required: true, done: p => p.credentialCount > 0 },
  { key: 'title', label: 'Professional title', required: false, done: p => Boolean(p.professionalTitle) },
  { key: 'bio', label: 'Professional biography', required: false, done: p => Boolean(p.bio) },
  { key: 'education', label: 'Education and qualifications', required: false, done: p => Boolean(p.education) },
  { key: 'photo', label: 'Profile photograph', required: false, done: p => Boolean(p.photoStoredName) },
  { key: 'availability', label: 'Available days and time slots', required: false, done: p => p.availabilityCount > 0 },
];

export function computeProfileCompletion(profile: CompletionInput) {
  const results = CHECKS.map(c => ({ key: c.key, label: c.label, required: c.required, done: c.done(profile) }));
  const doneCount = results.filter(r => r.done).length;
  const missingRequired = results.filter(r => r.required && !r.done).map(r => r.label);
  return {
    percent: Math.round((doneCount / results.length) * 100),
    items: results,
    missingRequired,
    readyToSubmit: missingRequired.length === 0,
  };
}
