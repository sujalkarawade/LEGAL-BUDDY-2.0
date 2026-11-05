// Legal Buddy Connect — API integration tests against the real routers and a real PostgreSQL database.
// Requires DATABASE_URL with the Connect migration applied (npm run prisma:migrate).
// Every account/profile created here uses a unique "connect-test-<run>" email and is deleted afterwards.
//   npm run test:connect:api
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import bcrypt from 'bcryptjs';

process.env.GEOCODER_ENABLED = 'false'; // never call an external geocoder from tests

const { default: express } = await import('express');
const { default: prisma } = await import('../src/prisma/client.js');
const { errorHandler } = await import('../src/middleware/error-handler.js');
const { default: authRoutes } = await import('../src/routes/auth.routes.js');
const { default: documentRoutes } = await import('../src/routes/document.routes.js');
const connect = await import('../src/routes/connect.routes.js');
const { deletePrivateFile } = await import('../src/services/connect/connect-file.service.js');
const { processDueReminders } = await import('../src/services/insights/reminder.service.js');

const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const email = (who: string) => `connect-test-${RUN}-${who}@example.test`;
const PASSWORD = 'Connect-Test-Pass-1';
const PUNE = { lat: 18.5204, lng: 73.8567 };     // search origin
const OFFICE = { lat: 18.5308, lng: 73.8475 };   // ~1.5 km from origin
const DELHI = { lat: 28.6139, lng: 77.209 };     // ~1,170 km away
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
const futureDate = (days: number) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };

let server: Server;
let base = '';
const tokens: Record<string, string> = {};
const userIds: string[] = [];
let tmpDir = '';
let contractLawId = '';
let lawyerProfileId = '';
let userDocId = '';
let otherUserDocId = '';
let otherClauseId = '';
let obligationId = '';

async function api(method: string, url: string, token?: string, body?: unknown) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload: FormData | string | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(`${base}${url}`, { method, headers, body: payload });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json, raw: text, headers: res.headers };
}

async function createAccount(key: string, role: 'USER' | 'ADMIN') {
  const user = await prisma.user.create({ data: { email: email(key), name: `Test ${key}`, role, passwordHash: await bcrypt.hash(PASSWORD, 4) } });
  userIds.push(user.id);
  const r = await api('POST', '/api/auth/login', undefined, { email: email(key), password: PASSWORD });
  assert.equal(r.status, 200);
  tokens[key] = r.body.token;
  return user;
}

async function registerLawyer(key: string, enrollmentNumber: string) {
  return api('POST', '/api/auth/register-lawyer', undefined, {
    name: `Adv. Test ${key}`, email: email(key), password: PASSWORD, barCouncilState: 'Maharashtra & Goa', enrollmentNumber,
  });
}

async function completeLawyerProfile(token: string, office: { lat: number; lng: number }) {
  let r = await api('PUT', '/api/lawyer-portal/profile', token, {
    practiceStartYear: 2016, languages: ['english', 'Marathi'], specializationIds: [contractLawId], contactPhone: '+91 98765 43210',
    offersOnline: true, publishPhone: false,
  });
  assert.equal(r.status, 200, r.raw);
  r = await api('PUT', '/api/lawyer-portal/office', token, {
    addressLine: '12 Test Chambers, FC Road', city: 'Pune', state: 'Maharashtra', postalCode: '411004', latitude: office.lat, longitude: office.lng,
  });
  assert.equal(r.status, 200, r.raw);
  const form = new FormData();
  form.append('kind', 'ENROLLMENT_CERTIFICATE');
  form.append('file', new Blob([PDF], { type: 'application/pdf' }), 'enrollment.pdf');
  r = await api('POST', '/api/lawyer-portal/credentials', token, form);
  assert.equal(r.status, 201, r.raw);
  return r.body.profile;
}

const nearby = (token: string, extra = '') => api('GET', `/api/lawyers/nearby?lat=${PUNE.lat}&lng=${PUNE.lng}&radiusKm=10${extra}`, token);
const ids = (r: { body: any }) => (r.body.lawyers || []).map((l: any) => l.id);

before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/documents', documentRoutes);
  app.use('/api/lawyers', connect.lawyerRoutes);
  app.use('/api/lawyer-portal', connect.lawyerPortalRoutes);
  app.use('/api/consultations', connect.consultationRoutes);
  app.use('/api/admin/connect', connect.adminConnectRoutes);
  app.use('/api/notifications', connect.notificationRoutes);
  app.use(errorHandler);
  server = await new Promise<Server>(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

  const spec = await prisma.specialization.findUnique({ where: { slug: 'contract-law' } });
  assert.ok(spec, 'Run the Legal Buddy Connect migration first (specializations are seeded by it).');
  contractLawId = spec.id;

  const user = await createAccount('user', 'USER');
  const other = await createAccount('other', 'USER');
  await createAccount('admin', 'ADMIN');

  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lb-connect-'));
  const docPath = path.join(tmpDir, 'contract.pdf');
  fs.writeFileSync(docPath, PDF);
  const mkDoc = (userId: string) => prisma.document.create({ data: {
    userId, originalName: 'contract.pdf', storedName: 'contract.pdf', filePath: docPath, fileSize: PDF.length, mimeType: 'application/pdf', status: 'COMPLETED',
  } });
  userDocId = (await mkDoc(user.id)).id;
  otherUserDocId = (await mkDoc(other.id)).id;
  await prisma.clauseFinding.create({ data: {
    documentId: userDocId, category: 'Liability', title: 'Limitation of liability', riskLevel: 'High',
    excerpt: 'SECRET-EXCERPT: Supplier liability shall be unlimited.', plainLanguageExplanation: 'SECRET-EXPLANATION',
  } });
  otherClauseId = (await prisma.clauseFinding.create({ data: {
    // Low risk on purpose: the AI-matching test below expects this document to produce no suggestion.
    documentId: otherUserDocId, category: 'Payment', title: 'Payment terms', riskLevel: 'Low',
    excerpt: 'Invoices are payable within 90 days.', plainLanguageExplanation: 'Sets the payment period.',
  } })).id;
  obligationId = (await prisma.extractedObligation.create({ data: {
    documentId: userDocId, category: 'Renewal & Expiry Dates', description: 'The agreement expires on 15 March 2027.',
    dueDateOrPeriod: '15 March 2027', isCalendarDate: true, excerpt: 'The agreement expires on 15 March 2027.',
  } })).id;
});

after(async () => {
  server?.close();
  const profiles = await prisma.lawyerProfile.findMany({ where: { user: { email: { startsWith: `connect-test-${RUN}` } } }, select: { id: true, userId: true } });
  userIds.push(...profiles.map(p => p.userId));
  const files = await prisma.lawyerCredential.findMany({ where: { lawyerProfileId: { in: profiles.map(p => p.id) } }, select: { storedName: true } });
  for (const f of files) await deletePrivateFile('credentials', f.storedName);
  await prisma.adminAuditLog.deleteMany({ where: { adminId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } }); // cascades to profiles, consultations, documents, notifications
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  await prisma.$disconnect();
});

// ─── A/B. Authentication, authorization and registration ───────────────────
test('lawyer registration validates input and blocks duplicate enrollment numbers', async () => {
  const missing = await api('POST', '/api/auth/register-lawyer', undefined, { name: 'X Y', email: email('x'), password: PASSWORD });
  assert.equal(missing.status, 400);

  const ok = await registerLawyer('lawyer', `MAH/${RUN}/2016`);
  assert.equal(ok.status, 201, ok.raw);
  assert.equal(ok.body.user.role, 'LAWYER');
  tokens.lawyer = ok.body.token;

  const dup = await registerLawyer('lawyer-dup', ` mah ${RUN} 2016 `);
  assert.equal(dup.status, 409, 'same enrollment number in another format is a duplicate');

  const roleSmuggle = await api('POST', '/api/auth/register', undefined, { email: email('smuggle'), password: PASSWORD, name: 'Smuggle', role: 'ADMIN' });
  if (roleSmuggle.status === 201) { userIds.push(roleSmuggle.body.user.id); assert.equal(roleSmuggle.body.user.role, 'USER'); }
});

test('role-based access is enforced on the server', async () => {
  assert.equal((await api('GET', '/api/lawyer-portal/profile')).status, 401);
  assert.equal((await api('GET', '/api/lawyer-portal/profile', tokens.user)).status, 403);
  assert.equal((await api('GET', '/api/admin/connect/stats', tokens.user)).status, 403);
  assert.equal((await api('GET', '/api/admin/connect/stats', tokens.lawyer)).status, 403);
  assert.equal((await api('GET', '/api/admin/connect/stats', tokens.admin)).status, 200);
  assert.equal((await api('POST', '/api/consultations', tokens.lawyer, {})).status, 403);
  assert.equal((await api('GET', '/api/lawyers/nearby?lat=18.5&lng=73.8', 'not-a-token')).status, 401);
});

test('lawyers cannot verify themselves or change admin-only fields', async () => {
  const r = await api('PUT', '/api/lawyer-portal/profile', tokens.lawyer, { status: 'VERIFIED' });
  assert.equal(r.status, 400);
  const r2 = await api('PUT', '/api/lawyer-portal/profile', tokens.lawyer, { verifiedAt: new Date().toISOString(), bio: 'x' });
  assert.equal(r2.status, 400);
  const decision = await api('POST', `/api/admin/connect/lawyers/${(await prisma.lawyerProfile.findFirstOrThrow({ where: { user: { email: email('lawyer') } } })).id}/decision`, tokens.lawyer, { action: 'APPROVE', credentialsReviewed: true });
  assert.equal(decision.status, 403);
});

test('invalid office location and invalid uploads are rejected', async () => {
  const bad = await api('PUT', '/api/lawyer-portal/office', tokens.lawyer, { addressLine: '12 Road', city: 'Pune', state: 'MH', postalCode: '411004', latitude: 0, longitude: 0 });
  assert.equal(bad.status, 400);
  const form = new FormData();
  form.append('kind', 'ENROLLMENT_CERTIFICATE');
  form.append('file', new Blob(['<html>not a pdf</html>'], { type: 'application/pdf' }), 'fake.pdf');
  assert.equal((await api('POST', '/api/lawyer-portal/credentials', tokens.lawyer, form)).status, 400);
  const exe = new FormData();
  exe.append('kind', 'OTHER');
  exe.append('file', new Blob(['MZ'], { type: 'application/x-msdownload' }), 'tool.exe');
  assert.equal((await api('POST', '/api/lawyer-portal/credentials', tokens.lawyer, exe)).status, 400);
});

// ─── C/D. Verification workflow and search visibility ───────────────────────
test('profile goes from draft to pending and stays out of search until approved', async () => {
  const early = await api('POST', '/api/lawyer-portal/submit', tokens.lawyer);
  assert.equal(early.status, 400, 'incomplete profiles cannot be submitted');

  const profile = await completeLawyerProfile(tokens.lawyer, OFFICE);
  lawyerProfileId = profile.id;
  assert.equal(profile.completion.readyToSubmit, true);

  const submitted = await api('POST', '/api/lawyer-portal/submit', tokens.lawyer);
  assert.equal(submitted.status, 200, submitted.raw);
  assert.equal(submitted.body.profile.status, 'PENDING_REVIEW');

  assert.equal(ids(await nearby(tokens.user)).includes(lawyerProfileId), false);
  assert.equal((await api('GET', `/api/lawyers/${lawyerProfileId}`, tokens.user)).status, 404);
});

test('credentials are private to the owner and admins', async () => {
  const credId = (await prisma.lawyerCredential.findFirstOrThrow({ where: { lawyerProfileId } })).id;
  assert.equal((await api('GET', `/api/admin/connect/lawyers/${lawyerProfileId}/credentials/${credId}`, tokens.user)).status, 403);
  assert.equal((await api('GET', `/api/lawyer-portal/credentials/${credId}`, tokens.user)).status, 403);
  const own = await api('GET', `/api/lawyer-portal/credentials/${credId}`, tokens.lawyer);
  assert.equal(own.status, 200);
  assert.equal(own.headers.get('x-content-type-options'), 'nosniff');
  const admin = await api('GET', `/api/admin/connect/lawyers/${lawyerProfileId}/credentials/${credId}`, tokens.admin);
  assert.equal(admin.status, 200);
});

test('admin approval requires an explicit review confirmation and is audited', async () => {
  const noConfirm = await api('POST', `/api/admin/connect/lawyers/${lawyerProfileId}/decision`, tokens.admin, { action: 'APPROVE' });
  assert.equal(noConfirm.status, 400);
  const rejectNoReason = await api('POST', `/api/admin/connect/lawyers/${lawyerProfileId}/decision`, tokens.admin, { action: 'REJECT' });
  assert.equal(rejectNoReason.status, 400);

  const ok = await api('POST', `/api/admin/connect/lawyers/${lawyerProfileId}/decision`, tokens.admin, { action: 'APPROVE', credentialsReviewed: true, reason: 'Enrollment certificate checked.' });
  assert.equal(ok.status, 200, ok.raw);
  const audit = await prisma.adminAuditLog.findFirstOrThrow({ where: { entityId: lawyerProfileId, action: 'LAWYER_APPROVE' } });
  assert.equal(audit.previousStatus, 'PENDING_REVIEW');
  assert.equal(audit.newStatus, 'VERIFIED');
  assert.ok(audit.adminId);

  const again = await api('POST', `/api/admin/connect/lawyers/${lawyerProfileId}/decision`, tokens.admin, { action: 'APPROVE', credentialsReviewed: true });
  assert.equal(again.status, 409, 'cannot approve an already verified profile');

  const notice = await prisma.notification.findFirst({ where: { user: { email: email('lawyer') }, type: 'LAWYER_APPROVE' } });
  assert.ok(notice, 'lawyer is notified in-app');

  const locked = await api('PUT', '/api/lawyer-portal/profile', tokens.lawyer, { enrollmentNumber: 'MAH/0000/2020' });
  assert.equal(locked.status, 409, 'enrollment details are locked after verification');
});

test('nearby search: radius, filters, pagination, validation and public projection', async () => {
  const r = await nearby(tokens.user);
  assert.equal(r.status, 200);
  const me = r.body.lawyers.find((l: any) => l.id === lawyerProfileId);
  assert.ok(me, 'verified lawyer is found');
  assert.ok(me.distanceKm > 0.5 && me.distanceKm < 3, `distance ${me.distanceKm}`);
  assert.equal(me.legalBuddyVerified, true);
  assert.equal(me.contact.phone, null, 'unpublished phone stays private');
  for (const key of ['userId', 'credentials', 'statusReason', 'verifiedById', 'enrollmentNumberNormalized']) assert.equal(key in me, false, key);

  const far = await api('GET', `/api/lawyers/nearby?lat=${DELHI.lat}&lng=${DELHI.lng}&radiusKm=100`, tokens.user);
  assert.equal(ids(far).includes(lawyerProfileId), false);

  assert.equal(ids(await nearby(tokens.user, '&specialization=criminal-law')).includes(lawyerProfileId), false);
  assert.equal(ids(await nearby(tokens.user, '&specialization=contract-law')).includes(lawyerProfileId), true);
  assert.equal(ids(await nearby(tokens.user, '&language=MARATHI')).includes(lawyerProfileId), true);
  assert.equal(ids(await nearby(tokens.user, '&experience=0-2')).includes(lawyerProfileId), false);
  assert.equal(ids(await nearby(tokens.user, '&availability=UNAVAILABLE')).includes(lawyerProfileId), false);

  const paged = await nearby(tokens.user, '&pageSize=1&page=1');
  assert.equal(paged.body.lawyers.length, 1);
  assert.ok(paged.body.pagination.total >= 1);

  assert.equal((await api('GET', '/api/lawyers/nearby?lat=999&lng=73', tokens.user)).status, 400);
  assert.equal((await api('GET', `/api/lawyers/nearby?lat=${PUNE.lat}&lng=${PUNE.lng}&radiusKm=7`, tokens.user)).status, 400);
  const empty = await api('GET', '/api/lawyers/nearby?lat=8.0883&lng=77.5385&radiusKm=5&specialization=taxation-law&experience=0-2', tokens.user);
  assert.equal(empty.status, 200);
  assert.ok(Array.isArray(empty.body.lawyers));

  const profile = await api('GET', `/api/lawyers/${lawyerProfileId}`, tokens.user);
  assert.equal(profile.status, 200);
  assert.equal(profile.raw.includes('enrollment.pdf'), false, 'credential file names never leak');
});

// ─── E. Consultations ──────────────────────────────────────────────────────
const consultation = (extra: Record<string, unknown> = {}) => ({
  lawyerId: lawyerProfileId, contactName: 'Test User', contactPhone: '+91 91234 56789', contactEmail: email('user'),
  specializationId: contractLawId, description: 'I need advice on an unlimited liability clause in a supplier agreement.',
  mode: 'ONLINE', preferredDate: futureDate(5), preferredTime: '11:00', ...extra,
});

test('document sharing requires consent and ownership', async () => {
  const foreign = await api('POST', '/api/consultations', tokens.user, consultation({ sharedDocumentId: otherUserDocId, documentShareConsent: true }));
  assert.equal(foreign.status, 404, "cannot share another user's document");
  const noConsent = await api('POST', '/api/consultations', tokens.user, consultation({ sharedDocumentId: userDocId }));
  assert.equal(noConsent.status, 400);
  const past = await api('POST', '/api/consultations', tokens.user, consultation({ preferredDate: '2000-01-01' }));
  assert.equal(past.status, 400);
});

test('consultation lifecycle with ownership checks and notifications', async () => {
  const created = await api('POST', '/api/consultations', tokens.user, consultation({ sharedDocumentId: userDocId, documentShareConsent: true }));
  assert.equal(created.status, 201, created.raw);
  const id = created.body.consultation.id;

  const dup = await api('POST', '/api/consultations', tokens.user, consultation());
  assert.equal(dup.status, 409, 'one open request per lawyer');

  assert.ok(await prisma.notification.findFirst({ where: { user: { email: email('lawyer') }, type: 'CONSULTATION_REQUESTED' } }));
  const lawyerNotice = await prisma.notification.findFirstOrThrow({ where: { user: { email: email('lawyer') }, type: 'CONSULTATION_REQUESTED' } });
  assert.equal(lawyerNotice.body.includes('unlimited liability'), false, 'notifications never contain the issue description');

  // Cross-user isolation
  assert.equal((await api('GET', `/api/consultations/${id}`, tokens.other)).status, 404);
  assert.equal((await api('PATCH', `/api/consultations/${id}`, tokens.other, { action: 'CANCEL' })).status, 404);
  assert.equal((await api('GET', '/api/consultations', tokens.other)).body.consultations.some((c: any) => c.id === id), false);

  // Lawyer sees it and can open the consented document
  const list = await api('GET', '/api/lawyer-portal/consultations', tokens.lawyer);
  const seen = list.body.consultations.find((c: any) => c.id === id);
  assert.ok(seen);
  assert.equal(seen.sharedDocument.originalName, 'contract.pdf');
  assert.equal((await api('GET', `/api/lawyer-portal/consultations/${id}/document`, tokens.lawyer)).status, 200);

  // User confirms too early → invalid
  assert.equal((await api('PATCH', `/api/consultations/${id}`, tokens.user, { action: 'CONFIRM' })).status, 409);

  // Lawyer proposes another time → user accepts it
  const proposed = await api('PATCH', `/api/lawyer-portal/consultations/${id}`, tokens.lawyer, { action: 'PROPOSE_TIME', proposedDate: futureDate(7), proposedTime: '16:30' });
  assert.equal(proposed.status, 200, proposed.raw);
  assert.equal(proposed.body.consultation.status, 'RESCHEDULE_REQUESTED');
  const confirmed = await api('PATCH', `/api/consultations/${id}`, tokens.user, { action: 'CONFIRM' });
  assert.equal(confirmed.body.consultation.status, 'CONFIRMED');
  assert.equal(confirmed.body.consultation.scheduledTime, '16:30');
  assert.ok(await prisma.notification.findFirst({ where: { user: { email: email('user') }, type: 'CONSULTATION_TIME_PROPOSED' } }));

  // User requests a reschedule → lawyer accepts → user confirms → lawyer completes
  const resched = await api('PATCH', `/api/consultations/${id}`, tokens.user, { action: 'REQUEST_RESCHEDULE', preferredDate: futureDate(9), preferredTime: '10:00' });
  assert.equal(resched.body.consultation.status, 'RESCHEDULE_REQUESTED');
  assert.equal((await api('PATCH', `/api/lawyer-portal/consultations/${id}`, tokens.lawyer, { action: 'ACCEPT' })).body.consultation.status, 'ACCEPTED');
  assert.equal((await api('PATCH', `/api/consultations/${id}`, tokens.user, { action: 'CONFIRM' })).body.consultation.status, 'CONFIRMED');

  // Revoking consent removes lawyer access immediately
  assert.equal((await api('PATCH', `/api/consultations/${id}`, tokens.user, { action: 'REVOKE_DOCUMENT' })).status, 200);
  assert.equal((await api('GET', `/api/lawyer-portal/consultations/${id}/document`, tokens.lawyer)).status, 404);

  assert.equal((await api('PATCH', `/api/lawyer-portal/consultations/${id}`, tokens.lawyer, { action: 'COMPLETE' })).body.consultation.status, 'COMPLETED');
  assert.equal((await api('PATCH', `/api/consultations/${id}`, tokens.user, { action: 'CANCEL' })).status, 409, 'completed requests cannot be cancelled');
});

test('rejection and user cancellation paths', async () => {
  const a = await api('POST', '/api/consultations', tokens.user, consultation({ mode: 'IN_PERSON' }));
  assert.equal(a.status, 201, a.raw);
  const rejected = await api('PATCH', `/api/lawyer-portal/consultations/${a.body.consultation.id}`, tokens.lawyer, { action: 'REJECT', message: 'Not available.' });
  assert.equal(rejected.body.consultation.status, 'REJECTED');
  assert.ok(await prisma.notification.findFirst({ where: { user: { email: email('user') }, type: 'CONSULTATION_REJECTED' } }));

  const b = await api('POST', '/api/consultations', tokens.user, consultation());
  assert.equal(b.status, 201);
  const cancelled = await api('PATCH', `/api/consultations/${b.body.consultation.id}`, tokens.user, { action: 'CANCEL' });
  assert.equal(cancelled.body.consultation.status, 'CANCELLED');
  assert.ok(await prisma.notification.findFirst({ where: { user: { email: email('lawyer') }, type: 'CONSULTATION_CANCELLED' } }));
});

// ─── F. AI matching ────────────────────────────────────────────────────────
test('lawyer matching uses categories only and respects document ownership', async () => {
  const r = await api('GET', `/api/documents/${userDocId}/lawyer-match`, tokens.user);
  assert.equal(r.status, 200, r.raw);
  assert.equal(r.body.unclear, false);
  assert.ok(r.body.suggestions.some((s: any) => s.slug === 'contract-law'));
  assert.equal(r.raw.includes('SECRET-EXCERPT'), false, 'no clause excerpt is returned');
  assert.equal(r.raw.includes('SECRET-EXPLANATION'), false);
  assert.equal((await api('GET', `/api/documents/${userDocId}/lawyer-match`, tokens.other)).status, 404);

  const unanalysed = await api('GET', `/api/documents/${otherUserDocId}/lawyer-match`, tokens.other);
  assert.equal(unanalysed.body.unclear, true);
  assert.equal(unanalysed.body.suggestions.length, 0);
});

// ─── C (cont.). Request info, rejection, suspension ─────────────────────────
test('request-info and rejection workflow for a second lawyer', async () => {
  const reg = await registerLawyer('lawyer2', `MAH/${RUN}/2019`);
  assert.equal(reg.status, 201);
  tokens.lawyer2 = reg.body.token;
  const profile = await completeLawyerProfile(tokens.lawyer2, OFFICE);
  assert.equal((await api('POST', '/api/lawyer-portal/submit', tokens.lawyer2)).status, 200);

  const info = await api('POST', `/api/admin/connect/lawyers/${profile.id}/decision`, tokens.admin, { action: 'REQUEST_INFO', reason: 'Upload a clearer enrollment certificate.' });
  assert.equal(info.status, 200);
  const own = await api('GET', '/api/lawyer-portal/profile', tokens.lawyer2);
  assert.equal(own.body.profile.status, 'INFO_REQUESTED');
  assert.match(own.body.profile.statusReason, /clearer/);

  assert.equal((await api('POST', '/api/lawyer-portal/submit', tokens.lawyer2)).status, 200);
  const rejected = await api('POST', `/api/admin/connect/lawyers/${profile.id}/decision`, tokens.admin, { action: 'REJECT', reason: 'Enrollment number does not match the certificate.' });
  assert.equal(rejected.status, 200);
  assert.equal(ids(await nearby(tokens.user)).includes(profile.id), false);
});

test('suspended profiles disappear from search and cannot act on requests', async () => {
  const pending = await api('POST', '/api/consultations', tokens.user, consultation());
  assert.equal(pending.status, 201);

  const s = await api('POST', `/api/admin/connect/lawyers/${lawyerProfileId}/decision`, tokens.admin, { action: 'SUSPEND', reason: 'Report under investigation.' });
  assert.equal(s.status, 200);
  assert.equal(ids(await nearby(tokens.user)).includes(lawyerProfileId), false);
  assert.equal((await api('GET', `/api/lawyers/${lawyerProfileId}`, tokens.user)).status, 404);
  assert.equal((await api('PATCH', `/api/lawyer-portal/consultations/${pending.body.consultation.id}`, tokens.lawyer, { action: 'ACCEPT' })).status, 403);
  assert.equal((await api('POST', '/api/consultations', tokens.other, consultation({ contactEmail: email('other') }))).status, 404);

  const restore = await api('POST', `/api/admin/connect/lawyers/${lawyerProfileId}/decision`, tokens.admin, { action: 'RESTORE', reason: 'Investigation closed.' });
  assert.equal(restore.status, 200);
  assert.equal(ids(await nearby(tokens.user)).includes(lawyerProfileId), true);

  const history = await api('GET', `/api/admin/connect/lawyers/${lawyerProfileId}`, tokens.admin);
  const actions = history.body.history.map((h: any) => h.action);
  for (const a of ['LAWYER_APPROVE', 'LAWYER_SUSPEND', 'LAWYER_RESTORE']) assert.ok(actions.includes(a), a);
});

// ─── G. Reports & contact preference enforcement ───────────────────────────
test('reports are created once per user and resolved by admins only', async () => {
  const r = await api('POST', `/api/lawyers/${lawyerProfileId}/report`, tokens.user, { reason: 'INCORRECT_INFORMATION', details: 'Office address looks wrong.' });
  assert.equal(r.status, 201);
  assert.equal((await api('POST', `/api/lawyers/${lawyerProfileId}/report`, tokens.user, { reason: 'OTHER' })).status, 409);
  const report = await prisma.lawyerReport.findFirstOrThrow({ where: { lawyerProfileId } });
  assert.equal((await api('PATCH', `/api/admin/connect/reports/${report.id}`, tokens.user, { status: 'DISMISSED', resolution: 'no' })).status, 403);
  assert.equal((await api('PATCH', `/api/admin/connect/reports/${report.id}`, tokens.admin, { status: 'RESOLVED', resolution: 'Lawyer corrected the address.' })).status, 200);
});

test('publishing contact details requires explicit consent and is reflected publicly', async () => {
  const noPhoneConsent = await api('GET', `/api/lawyers/${lawyerProfileId}`, tokens.user);
  assert.equal(noPhoneConsent.body.lawyer.contact.phone, null);
  assert.equal((await api('PUT', '/api/lawyer-portal/profile', tokens.lawyer, { publishPhone: true })).status, 200);
  const published = await api('GET', `/api/lawyers/${lawyerProfileId}`, tokens.user);
  assert.equal(published.body.lawyer.contact.phone, '+91 98765 43210');
  assert.equal((await api('PUT', '/api/lawyer-portal/profile', tokens.lawyer, { publishEmail: true, contactEmail: '' })).status, 400, 'cannot publish an empty email');
});

// ─── Insights: lawyer clause review, reminders, calendar, law checks, compare ───
test('lawyer clause review requires the separate analysis consent and stays private', async () => {
  const noDoc = await api('POST', '/api/consultations', tokens.other, consultation({ contactEmail: email('other'), analysisShareConsent: true }));
  assert.equal(noDoc.status, 400, 'analysis sharing needs a shared document');

  const created = await api('POST', '/api/consultations', tokens.other, consultation({
    contactEmail: email('other'), sharedDocumentId: otherUserDocId, documentShareConsent: true, analysisShareConsent: true,
  }));
  assert.equal(created.status, 201, created.raw);
  const id = created.body.consultation.id;
  assert.equal(created.body.consultation.sharedDocument.analysisShared, true);

  const review = await api('GET', `/api/lawyer-portal/consultations/${id}/review`, tokens.lawyer);
  assert.equal(review.status, 200, review.raw);
  assert.ok(review.body.clauses.some((c: any) => c.id === otherClauseId));

  const bad = await api('POST', `/api/lawyer-portal/consultations/${id}/review`, tokens.lawyer, { clauseFindingId: '00000000-0000-4000-8000-000000000000', comment: 'x y' });
  assert.equal(bad.status, 400, 'clause must belong to the shared document');

  const comment = await api('POST', `/api/lawyer-portal/consultations/${id}/review`, tokens.lawyer, {
    clauseFindingId: otherClauseId, verdict: 'NEEDS_CHANGE', comment: '90 days is long; ask for 30.', suggestedText: 'Invoices are payable within 30 days.',
  });
  assert.equal(comment.status, 201, comment.raw);
  assert.ok(await prisma.notification.findFirst({ where: { user: { email: email('other') }, type: 'CLAUSE_REVIEW_COMMENT' } }));

  const reply = await api('POST', `/api/consultations/${id}/review`, tokens.other, { clauseFindingId: otherClauseId, comment: 'Agreed, thank you.', verdict: 'ACCEPTABLE' });
  assert.equal(reply.status, 201, reply.raw);
  assert.equal(reply.body.comments.at(-1).verdict, 'COMMENT', 'clients cannot set a lawyer verdict');

  assert.equal((await api('GET', `/api/consultations/${id}/review`, tokens.user)).status, 404, 'other users cannot read the review');
  const docFeedback = await api('GET', `/api/documents/${otherUserDocId}/lawyer-reviews`, tokens.other);
  assert.equal(docFeedback.body.comments.length, 2);
  assert.equal((await api('GET', `/api/documents/${otherUserDocId}/lawyer-reviews`, tokens.user)).status, 404);

  assert.equal((await api('PATCH', `/api/consultations/${id}`, tokens.other, { action: 'REVOKE_DOCUMENT' })).status, 200);
  assert.equal((await api('GET', `/api/lawyer-portal/consultations/${id}/review`, tokens.lawyer)).status, 404, 'revoking sharing closes the review');
});

test('obligation reminders, notifications and calendar export', async () => {
  assert.equal((await api('PUT', `/api/documents/${userDocId}/obligations/${obligationId}/reminder`, tokens.other, { remindOn: '2027-03-01' })).status, 404);
  assert.equal((await api('PUT', `/api/documents/${userDocId}/obligations/${obligationId}/reminder`, tokens.user, { remindOn: 'tomorrow' })).status, 400);
  const set = await api('PUT', `/api/documents/${userDocId}/obligations/${obligationId}/reminder`, tokens.user, { remindOn: '2027-03-01', note: 'Decide on renewal' });
  assert.equal(set.status, 200, set.raw);

  const ics = await api('GET', `/api/documents/${userDocId}/obligations/calendar.ics`, tokens.user);
  assert.equal(ics.status, 200);
  assert.match(ics.headers.get('content-type') || '', /text\/calendar/);
  assert.equal((ics.raw.match(/BEGIN:VEVENT/g) || []).length, 2, 'dated obligation + reminder');
  assert.ok(ics.raw.includes('DTSTART;VALUE=DATE:20270315'));
  assert.ok(ics.raw.includes('DTSTART;VALUE=DATE:20270301'));

  await prisma.obligationReminder.updateMany({ where: { obligationId }, data: { remindOn: '2020-01-01' } });
  const sent = await processDueReminders();
  assert.ok(sent >= 1);
  assert.ok(await prisma.notification.findFirst({ where: { user: { email: email('user') }, type: 'OBLIGATION_REMINDER' } }));
  assert.equal(await processDueReminders(), 0, 'each reminder fires once');
});

test('Indian law checks, risk score and template comparison endpoints', async () => {
  const before = await api('GET', `/api/documents/${userDocId}/insights`, tokens.user);
  assert.equal(before.status, 200);
  assert.equal(before.body.analysed, false, 'no extracted text yet');

  await prisma.document.update({ where: { id: userDocId }, data: { extractedText: '---PAGE_1---\nGoverning law: laws of India. Executed on e-stamp paper.\n---PAGE_2---\nThe employee shall not engage in any competing business for a period of two years after termination. The supplier shall pay liquidated damages of INR 5,000 per day.' } });
  const after = await api('GET', `/api/documents/${userDocId}/insights`, tokens.user);
  const rules = after.body.compliance.findings.map((f: any) => f.ruleId);
  assert.ok(rules.includes('ICA_S27_RESTRAINT_OF_TRADE'));
  assert.ok(rules.includes('ICA_S74_PENALTY'));
  assert.ok(after.body.riskScore.score > 0);
  assert.equal((await api('GET', `/api/documents/${userDocId}/insights`, tokens.other)).status, 404);

  const template = await prisma.documentTemplate.findFirst({ select: { id: true } });
  if (template) {
    const cmp = await api('GET', `/api/documents/${userDocId}/compare?templateId=${template.id}`, tokens.user);
    assert.equal(cmp.status, 200, cmp.raw);
    assert.equal(cmp.body.summary.total, cmp.body.sections.length);
  }
  assert.equal((await api('GET', `/api/documents/${userDocId}/compare?templateId=not-a-uuid`, tokens.user)).status, 400);
});

test('translation refuses arbitrary text and reports when no AI provider is configured', async () => {
  const bad = await api('POST', `/api/documents/${userDocId}/translate`, tokens.user, { target: 'mr', kind: 'summary', text: 'translate me' });
  assert.equal(bad.status, 400, 'free text is never accepted');
  const r = await api('POST', `/api/documents/${userDocId}/translate`, tokens.user, { target: 'mr', kind: 'clause' });
  assert.equal(r.status, 400, 'clauseId required');
});
