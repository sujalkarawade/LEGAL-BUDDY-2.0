// Legal Buddy Connect — pure unit tests (no database, no network).
//   npm run test:connect
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  nearbySearchSchema, lawyerProfileUpdateSchema, officeSchema, consultationCreateSchema, lawyerRegistrationSchema,
  adminDecisionSchema, normalizeEnrollmentNumber, normalizeLanguage, isPlausibleCoordinate, firstZodError,
} from '../src/services/connect/constants.js';
import { haversineKm, boundingBox, experienceYearRange } from '../src/services/connect/geo.service.js';
import { applyTransition, canLawyerAccessSharedDocument, isSchedulableDate, WorkflowError, type ConsultationState } from '../src/services/connect/consultation-workflow.js';
import { suggestSpecializations } from '../src/services/connect/lawyer-matching.service.js';
import { toPublicLawyer, isPubliclyVisible, yearsOfExperience } from '../src/services/connect/lawyer-serializer.js';
import { computeProfileCompletion } from '../src/services/connect/profile-completion.js';
import { hasValidSignature } from '../src/middleware/connect-upload.js';
import { parseNominatim } from '../src/services/connect/geocoding.service.js';

const PUNE = { lat: 18.5204, lng: 73.8567 };
const MUMBAI = { lat: 19.076, lng: 72.8777 };

// ─── Geography ──────────────────────────────────────────────────────────────
test('haversine distance Mumbai–Pune is about 120 km', () => {
  const d = haversineKm(MUMBAI.lat, MUMBAI.lng, PUNE.lat, PUNE.lng);
  assert.ok(d > 115 && d < 125, `got ${d}`);
  assert.equal(haversineKm(PUNE.lat, PUNE.lng, PUNE.lat, PUNE.lng), 0);
});

test('bounding box fully contains the search circle', () => {
  for (const radius of [5, 10, 25, 50, 100]) {
    const box = boundingBox(PUNE.lat, PUNE.lng, radius);
    for (let bearing = 0; bearing < 360; bearing += 15) {
      // Point ~radius km away along the bearing (small-distance approximation, slightly inside the circle).
      const rad = (bearing * Math.PI) / 180;
      const dLat = ((radius * 0.999) / 111.32) * Math.cos(rad);
      const dLng = ((radius * 0.999) / (111.32 * Math.cos((PUNE.lat * Math.PI) / 180))) * Math.sin(rad);
      const lat = PUNE.lat + dLat; const lng = PUNE.lng + dLng;
      assert.ok(lat >= box.minLat && lat <= box.maxLat && lng >= box.minLng && lng <= box.maxLng, `radius ${radius} bearing ${bearing}`);
    }
  }
});

test('experience bands map to practice start years without overlap', () => {
  const y = 2026;
  assert.deepEqual(experienceYearRange('0-2', y), { minStart: 2024, maxStart: 2026 });
  assert.deepEqual(experienceYearRange('3-5', y), { minStart: 2021, maxStart: 2023 });
  assert.deepEqual(experienceYearRange('6-10', y), { minStart: 2016, maxStart: 2020 });
  assert.equal(experienceYearRange('10+', y).maxStart, 2015);
  assert.equal(yearsOfExperience(2016, y), 10);
  assert.equal(yearsOfExperience(null, y), null);
});

// ─── Input validation ──────────────────────────────────────────────────────
test('nearby search rejects invalid coordinates and radii', () => {
  assert.equal(nearbySearchSchema.safeParse({ lat: '91', lng: '73' }).success, false);
  assert.equal(nearbySearchSchema.safeParse({ lat: 'abc', lng: '73' }).success, false);
  assert.equal(nearbySearchSchema.safeParse({ lat: '0', lng: '0' }).success, false, 'null island is rejected');
  assert.equal(nearbySearchSchema.safeParse({ lat: '18.5', lng: '73.8', radiusKm: '7' }).success, false);
  const ok = nearbySearchSchema.safeParse({ lat: '18.5', lng: '73.8' });
  assert.ok(ok.success);
  assert.equal(ok.data.radiusKm, 25);
  assert.equal(ok.data.verification, 'VERIFIED_ONLY');
  assert.equal(nearbySearchSchema.safeParse({ lat: '18.5', lng: '73.8', pageSize: '500' }).success, false);
});

test('lawyers cannot set verification or admin-only fields on their own profile', () => {
  for (const key of ['status', 'verifiedAt', 'verifiedById', 'source', 'isSynthetic', 'statusReason', 'userId']) {
    const r = lawyerProfileUpdateSchema.safeParse({ [key]: key === 'isSynthetic' ? true : 'VERIFIED' });
    assert.equal(r.success, false, `${key} must be rejected`);
    if (!r.success) assert.match(firstZodError(r.error), /not allowed/);
  }
  const partial = lawyerProfileUpdateSchema.safeParse({ bio: 'Advocate' });
  assert.ok(partial.success);
  assert.equal('professionalTitle' in partial.data && partial.data.professionalTitle !== undefined, false, 'omitted fields stay undefined (unchanged)');
});

test('office validation requires a PIN code and a real location', () => {
  const base = { addressLine: '12 FC Road', city: 'Pune', state: 'Maharashtra', postalCode: '411004', latitude: PUNE.lat, longitude: PUNE.lng };
  assert.ok(officeSchema.safeParse(base).success);
  assert.equal(officeSchema.safeParse({ ...base, postalCode: '41100' }).success, false);
  assert.equal(officeSchema.safeParse({ ...base, latitude: 0, longitude: 0 }).success, false);
  assert.equal(officeSchema.safeParse({ ...base, latitude: 120 }).success, false);
  assert.equal(isPlausibleCoordinate(NaN, 1), false);
});

test('registration and consultation schemas reject missing and unknown fields', () => {
  assert.equal(lawyerRegistrationSchema.safeParse({ name: 'A B', email: 'a@b.co', password: 'longenough', barCouncilState: 'Maharashtra & Goa' }).success, false);
  assert.equal(lawyerRegistrationSchema.safeParse({ name: 'A B', email: 'a@b.co', password: 'longenough', barCouncilState: 'Atlantis', enrollmentNumber: 'X/1/2' }).success, false);
  assert.equal(lawyerRegistrationSchema.safeParse({ name: 'A B', email: 'a@b.co', password: 'longenough', barCouncilState: 'Delhi', enrollmentNumber: 'D/1/2', role: 'ADMIN' }).success, false);
  const consult = {
    lawyerId: '7d0f8f5e-5f2b-4c39-9a51-0d6d1b0c4f11', contactName: 'Asha', contactPhone: '+91 98765 43210', contactEmail: 'asha@example.com',
    description: 'Need help reviewing a vendor agreement liability clause.', mode: 'ONLINE', preferredDate: '2030-01-10', preferredTime: '10:30',
  };
  assert.ok(consultationCreateSchema.safeParse(consult).success);
  assert.equal(consultationCreateSchema.safeParse({ ...consult, status: 'CONFIRMED' }).success, false);
  assert.equal(consultationCreateSchema.safeParse({ ...consult, preferredTime: '25:00' }).success, false);
  assert.equal(consultationCreateSchema.safeParse({ ...consult, description: 'short' }).success, false);
  assert.equal(adminDecisionSchema.safeParse({ action: 'MAKE_ADMIN' }).success, false);
});

test('enrollment numbers and languages are normalised for matching', () => {
  assert.equal(normalizeEnrollmentNumber('MAH/1234/2015'), normalizeEnrollmentNumber(' mah 1234-2015 '));
  assert.equal(normalizeLanguage('  marathi '), 'Marathi');
});

// ─── Consultation workflow ──────────────────────────────────────────────────
const base: ConsultationState = {
  status: 'PENDING', rescheduleRequestedBy: null, preferredDate: '2030-01-10', preferredTime: '10:00',
  proposedDate: null, proposedTime: null, scheduledDate: null, scheduledTime: null,
};

test('lawyer accepts, user confirms, lawyer completes', () => {
  const accepted = applyTransition(base, 'LAWYER', 'ACCEPT');
  assert.equal(accepted.status, 'ACCEPTED');
  assert.equal(accepted.updates.scheduledDate, '2030-01-10');
  assert.deepEqual(accepted.notify, { recipient: 'USER', event: 'CONSULTATION_ACCEPTED' });
  const confirmed = applyTransition({ ...base, ...accepted.updates, status: 'ACCEPTED' } as ConsultationState, 'USER', 'CONFIRM');
  assert.equal(confirmed.status, 'CONFIRMED');
  assert.equal(applyTransition({ ...base, status: 'CONFIRMED' }, 'LAWYER', 'COMPLETE').status, 'COMPLETED');
});

test('lawyer proposes a new time and the user accepts it', () => {
  const proposed = applyTransition(base, 'LAWYER', 'PROPOSE_TIME', { date: '2030-01-12', time: '15:00' });
  assert.equal(proposed.status, 'RESCHEDULE_REQUESTED');
  const state = { ...base, ...proposed.updates, status: 'RESCHEDULE_REQUESTED' } as ConsultationState;
  const confirmed = applyTransition(state, 'USER', 'CONFIRM');
  assert.equal(confirmed.status, 'CONFIRMED');
  assert.equal(confirmed.updates.scheduledDate, '2030-01-12');
  assert.equal(confirmed.updates.scheduledTime, '15:00');
  assert.throws(() => applyTransition(base, 'LAWYER', 'PROPOSE_TIME'), WorkflowError);
});

test('user reschedule request goes back to the lawyer for a decision', () => {
  const r = applyTransition({ ...base, status: 'CONFIRMED' }, 'USER', 'REQUEST_RESCHEDULE', { date: '2030-02-01', time: '11:00' });
  assert.equal(r.status, 'RESCHEDULE_REQUESTED');
  assert.equal(r.updates.rescheduleRequestedBy, 'USER');
  assert.equal(r.notify?.recipient, 'LAWYER');
  const state = { ...base, ...r.updates, status: 'RESCHEDULE_REQUESTED' } as ConsultationState;
  assert.equal(applyTransition(state, 'LAWYER', 'ACCEPT').status, 'ACCEPTED');
  assert.throws(() => applyTransition(state, 'USER', 'CONFIRM'), WorkflowError, 'user cannot confirm their own reschedule');
});

test('invalid transitions are refused', () => {
  assert.throws(() => applyTransition(base, 'USER', 'CONFIRM'), WorkflowError);
  assert.throws(() => applyTransition(base, 'LAWYER', 'COMPLETE'), WorkflowError);
  assert.throws(() => applyTransition({ ...base, status: 'REJECTED' }, 'LAWYER', 'ACCEPT'), WorkflowError);
  assert.throws(() => applyTransition({ ...base, status: 'CANCELLED' }, 'USER', 'CANCEL'), WorkflowError);
  assert.throws(() => applyTransition({ ...base, status: 'COMPLETED' }, 'LAWYER', 'CANCEL'), WorkflowError);
  assert.equal(applyTransition(base, 'LAWYER', 'REJECT').status, 'REJECTED');
  assert.equal(applyTransition(base, 'USER', 'CANCEL').updates.cancelledBy, 'USER');
});

test('shared documents are visible only with active consent on a live request', () => {
  const live = { status: 'ACCEPTED', sharedDocumentId: 'd', documentShareConsentAt: new Date(), documentShareRevokedAt: null };
  assert.equal(canLawyerAccessSharedDocument(live), true);
  assert.equal(canLawyerAccessSharedDocument({ ...live, documentShareConsentAt: null }), false);
  assert.equal(canLawyerAccessSharedDocument({ ...live, documentShareRevokedAt: new Date() }), false);
  assert.equal(canLawyerAccessSharedDocument({ ...live, status: 'CANCELLED' }), false);
  assert.equal(canLawyerAccessSharedDocument({ ...live, sharedDocumentId: null }), false);
});

test('preferred dates must be in the next 180 days', () => {
  assert.equal(isSchedulableDate('2026-01-09', '2026-01-10'), false);
  assert.equal(isSchedulableDate('2026-01-10', '2026-01-10'), true);
  assert.equal(isSchedulableDate('2026-07-09', '2026-01-10'), true);
  assert.equal(isSchedulableDate('2026-12-01', '2026-01-10'), false);
});

// ─── AI matching ────────────────────────────────────────────────────────────
test('high-risk liability and payment clauses suggest contract law with reasons', () => {
  const r = suggestSpecializations({
    clauses: [{ category: 'Liability', riskLevel: 'High' }, { category: 'Payment', riskLevel: 'Medium' }, { category: 'Dispute Resolution', riskLevel: 'Needs Review' }],
    contractType: 'Master Services Agreement', missingSections: ['Confidentiality Clause'],
  });
  assert.equal(r.unclear, false);
  assert.equal(r.suggestions[0].slug, 'contract-law');
  assert.ok(r.suggestions.some(s => s.slug === 'arbitration-dispute-resolution'));
  assert.ok(r.suggestions.every(s => s.reasons.length > 0));
  assert.match(r.disclaimer, /not legal advice/);
});

test('missing or unclear categories produce no suggestion', () => {
  const none = suggestSpecializations({ clauses: [], contractType: null, missingSections: [] });
  assert.equal(none.unclear, true);
  assert.equal(none.suggestions.length, 0);
  const lowOnly = suggestSpecializations({ clauses: [{ category: 'Payment', riskLevel: 'Low' }, { category: 'Unknown', riskLevel: 'High' }], contractType: null, missingSections: [] });
  assert.equal(lowOnly.unclear, true);
});

test('matching output never echoes anything except labels', () => {
  const secret = 'Party A shall pay INR 9,99,999 to account 1234567890';
  const r = suggestSpecializations({ clauses: [{ category: 'Payment', riskLevel: 'High' }], contractType: secret, missingSections: [] });
  assert.equal(JSON.stringify(r).includes('1234567890'), false);
});

// ─── Public projection ──────────────────────────────────────────────────────
function fakeProfile(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'p1', userId: 'u1', professionalName: 'Test Advocate', professionalTitle: null, bio: null, photoStoredName: null, photoMimeType: null,
    practiceStartYear: 2015, languages: ['English'], education: null, barCouncilState: 'Delhi', enrollmentNumber: 'D/1/2015', enrollmentNumberNormalized: 'D12015',
    enrollmentDate: null, status: 'VERIFIED', statusReason: 'internal note', source: 'LEGAL_BUDDY', isSynthetic: false,
    offersInPerson: true, offersOnline: false, acceptingRequests: true, feeDisclosed: false, consultationFeeInr: 1500,
    contactPhone: '+91 99999 00000', publishPhone: false, contactEmail: 'private@example.com', publishEmail: false,
    submittedAt: null, verifiedAt: new Date('2026-01-01'), verifiedById: 'admin', createdAt: new Date(), updatedAt: new Date(),
    offices: [], specializations: [], availability: [],
    ...overrides,
  };
}

test('public projection hides unpublished contact details, undisclosed fees and internal fields', () => {
  const pub = toPublicLawyer(fakeProfile());
  assert.equal(pub.contact.phone, null);
  assert.equal(pub.contact.email, null);
  assert.equal(pub.consultation.feeInr, null);
  const json = JSON.stringify(pub);
  for (const forbidden of ['private@example.com', '99999', 'internal note', 'userId', 'verifiedById', 'credentials', 'statusReason']) {
    assert.equal(json.includes(forbidden), false, `${forbidden} must not be public`);
  }
  const published = toPublicLawyer(fakeProfile({ publishPhone: true, publishEmail: true, feeDisclosed: true }));
  assert.equal(published.contact.phone, '+91 99999 00000');
  assert.equal(published.contact.email, 'private@example.com');
  assert.equal(published.consultation.feeInr, 1500);
});

test('only verified Legal Buddy profiles carry the verified badge', () => {
  assert.equal(toPublicLawyer(fakeProfile()).legalBuddyVerified, true);
  assert.equal(toPublicLawyer(fakeProfile({ source: 'EXTERNAL_DIRECTORY', status: 'LISTED' })).legalBuddyVerified, false);
  for (const status of ['DRAFT', 'PENDING_REVIEW', 'INFO_REQUESTED', 'REJECTED', 'SUSPENDED']) {
    assert.equal(isPubliclyVisible({ source: 'LEGAL_BUDDY', status }), false, status);
  }
  assert.equal(isPubliclyVisible({ source: 'EXTERNAL_DIRECTORY', status: 'VERIFIED' }), false, 'external rows can never be "verified"');
});

test('profile completion lists required items', () => {
  const c = computeProfileCompletion({
    professionalName: 'A', professionalTitle: null, bio: null, education: null, practiceStartYear: null, languages: [],
    barCouncilState: 'Delhi', enrollmentNumber: 'D/1', photoStoredName: null, offersInPerson: true, offersOnline: false,
    contactPhone: null, contactEmail: 'a@b.co', specializationCount: 0, hasOffice: false, credentialCount: 0, availabilityCount: 0,
  });
  assert.equal(c.readyToSubmit, false);
  assert.ok(c.missingRequired.includes('At least one verification document'));
  assert.ok(c.missingRequired.includes('Office address and map location'));
});

// ─── Uploads & geocoding parsing ────────────────────────────────────────────
test('file signatures must match the declared type', () => {
  assert.equal(hasValidSignature(Buffer.from('%PDF-1.7\n'), 'application/pdf'), true);
  assert.equal(hasValidSignature(Buffer.from('<html>'), 'application/pdf'), false);
  assert.equal(hasValidSignature(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg'), true);
  assert.equal(hasValidSignature(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'image/png'), false);
  assert.equal(hasValidSignature(Buffer.from('MZ'), 'application/x-msdownload'), false);
});

test('geocoder responses are parsed defensively', () => {
  assert.deepEqual(parseNominatim({ error: 'x' }), []);
  const r = parseNominatim([{ lat: '18.52', lon: '73.85', display_name: 'Pune, Maharashtra', address: { city: 'Pune', state: 'Maharashtra', postcode: '411001' } }, { lat: 'bad' }]);
  assert.equal(r.length, 1);
  assert.equal(r[0].city, 'Pune');
  assert.equal(r[0].postalCode, '411001');
});
