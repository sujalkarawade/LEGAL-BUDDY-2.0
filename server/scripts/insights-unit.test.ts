// Unit tests for the insight features (no database, no network).
//   npm run test:insights
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runIndianLawChecks, INDIAN_LAW_RULES } from '../src/services/insights/indian-law-checks.js';
import { computeRiskScore, bandFor, RISK_WEIGHTS } from '../src/services/insights/risk-score.js';
import { parseTemplateSections, compareWithTemplate, tokens } from '../src/services/insights/template-compare.js';
import { buildIcs, escapeIcsText, foldLine, parseExplicitDate } from '../src/services/insights/ics.js';
import { runClauseBenchmark, toMetrics } from '../src/services/insights/clause-benchmark.js';
import { canLawyerReviewAnalysis } from '../src/services/connect/consultation-workflow.js';
import { clauseReviewSchema, consultationCreateSchema } from '../src/services/connect/constants.js';
import { todayInIndia } from '../src/services/insights/reminder.service.js';

const ids = (text: string) => runIndianLawChecks(text).findings.map(f => f.ruleId);
const BASE = 'This agreement is executed on e-stamp paper and governed by the laws of India; courts at Pune have jurisdiction. ';

// ─── Indian law checks ─────────────────────────────────────────────────────
test('Section 27: post-termination non-compete is flagged, in-term restriction is not', () => {
  assert.ok(ids(`${BASE}The Employee shall not engage in any competing business for a period of two years after termination of employment.`).includes('ICA_S27_RESTRAINT_OF_TRADE'));
  assert.ok(!ids(`${BASE}During the term, the Employee shall not engage in any competing business. Laptops must be returned at the end.`).includes('ICA_S27_RESTRAINT_OF_TRADE'));
});

test('a non-compete far away from unrelated termination wording is not flagged', () => {
  const filler = ' The parties will cooperate in good faith on deliverables and reporting.'.repeat(20);
  const text = `${BASE}During the term the Consultant shall not compete with any similar business.${filler} Upon termination the Consultant shall return all documents.`;
  assert.equal(ids(text).includes('ICA_S27_RESTRAINT_OF_TRADE'), false);
});

test('Section 74 penalties, Section 28 claim bars, arbitration seat and DPDP', () => {
  assert.ok(ids(`${BASE}The supplier shall pay liquidated damages of 1% per week.`).includes('ICA_S74_PENALTY'));
  assert.ok(ids(`${BASE}Any claim must be brought within 3 months failing which it is waived.`).includes('ICA_S28_RESTRAINT_OF_PROCEEDINGS'));
  assert.ok(ids(`${BASE}The vendor waives the right to sue the client in any court.`).includes('ICA_S28_RESTRAINT_OF_PROCEEDINGS'));
  assert.ok(ids(`${BASE}Disputes shall be referred to arbitration by a sole arbitrator.`).includes('ACA_ARBITRATION_SEAT'));
  assert.ok(!ids(`${BASE}Disputes shall be referred to arbitration; the seat of arbitration shall be Mumbai.`).includes('ACA_ARBITRATION_SEAT'));
  assert.ok(ids(`${BASE}The processor will store customer data on its servers.`).includes('DPDP_PERSONAL_DATA'));
  assert.ok(!ids(`${BASE}The processor will store customer data and comply with the Digital Personal Data Protection Act, 2023.`).includes('DPDP_PERSONAL_DATA'));
});

test('stamp duty and governing-law information flags', () => {
  const plain = 'The parties agree to cooperate on the project and share progress reports every month without delay.';
  assert.ok(ids(plain).includes('STAMP_DUTY'));
  assert.ok(ids(plain).includes('GOVERNING_LAW_MISSING'));
  assert.ok(!ids(`${plain} This instrument is duly stamped.`).includes('STAMP_DUTY'));
  assert.ok(!ids(`${plain} मुद्रांक शुल्क भरले आहे.`).includes('STAMP_DUTY'), 'Marathi stamp wording is recognised');
});

test('findings carry statute, provision, page and excerpt, sorted by severity', () => {
  const r = runIndianLawChecks('---PAGE_1---\nIntro text for the agreement between the parties.\n---PAGE_2---\nThe supplier shall pay liquidated damages of INR 10,000 per day of delay.');
  const f = r.findings.find(x => x.ruleId === 'ICA_S74_PENALTY')!;
  assert.equal(f.pageNumber, 2);
  assert.match(f.excerpt!, /liquidated damages/);
  assert.match(f.provision, /Section 74/);
  const order = r.findings.map(x => x.severity);
  assert.deepEqual(order, [...order].sort((a, b) => ['IMPORTANT', 'REVIEW', 'INFO'].indexOf(a) - ['IMPORTANT', 'REVIEW', 'INFO'].indexOf(b)));
  assert.equal(r.rulesEvaluated, INDIAN_LAW_RULES.length);
  assert.equal(runIndianLawChecks('').findings.length, 0);
});

// ─── Risk score ────────────────────────────────────────────────────────────
test('risk score is traceable and capped per component', () => {
  const r = computeRiskScore({
    clauses: [{ category: 'Liability', title: 'Liability', riskLevel: 'High' }, { category: 'Payment', title: 'Payment', riskLevel: 'Low' }],
    completeness: [{ expectedSection: 'Confidentiality', status: 'NOT_FOUND' }],
    compliance: [{ ruleId: 'X', title: 'Penalty', severity: 'REVIEW' }],
  });
  assert.equal(r.score, RISK_WEIGHTS.clause.High + RISK_WEIGHTS.completeness.NOT_FOUND + RISK_WEIGHTS.compliance.REVIEW);
  assert.equal(r.contributions.reduce((s, c) => s + c.points, 0), r.score);
  assert.equal(r.contributions.some(c => c.label.includes('Payment')), false, 'low-risk clauses add nothing');

  const many = computeRiskScore({
    clauses: Array.from({ length: 10 }, (_, i) => ({ category: 'C', title: `C${i}`, riskLevel: 'High' })),
    completeness: Array.from({ length: 10 }, (_, i) => ({ expectedSection: `S${i}`, status: 'NOT_FOUND' })),
    compliance: Array.from({ length: 10 }, (_, i) => ({ ruleId: `R${i}`, title: `R${i}`, severity: 'IMPORTANT' as const })),
  });
  assert.equal(many.score, 100);
  assert.equal(many.components.clauses, RISK_WEIGHTS.caps.clauses);
  assert.equal(bandFor(0), 'Low');
  assert.equal(bandFor(25), 'Moderate');
  assert.equal(bandFor(50), 'High');
  assert.equal(bandFor(75), 'Very high');
});

// ─── Template comparison ───────────────────────────────────────────────────
const TEMPLATE = `MUTUAL NDA\n\n1. PURPOSE\nThe Parties wish to evaluate a prospective engagement involving {{purpose}}.\n\n2. CONFIDENTIAL INFORMATION\nConfidential Information includes technical, financial and commercial information disclosed by the Disclosing Party.\n\n3. GOVERNING LAW\nThis Agreement shall be governed by the laws of {{governingLaw}} and courts there have exclusive jurisdiction.\n\nIN WITNESS WHEREOF the parties sign.`;

test('template sections are parsed from numbered headings', () => {
  const s = parseTemplateSections(TEMPLATE);
  assert.deepEqual(s.map(x => x.heading), ['PURPOSE', 'CONFIDENTIAL INFORMATION', 'GOVERNING LAW']);
  assert.equal(s[2].body.includes('IN WITNESS'), false);
  assert.equal(tokens('{{purpose}} the Agreement').has('purpose'), false, 'placeholders are ignored');
});

test('comparison marks present, different and missing sections', () => {
  const r = compareWithTemplate(TEMPLATE, [
    { pageNumber: 1, content: 'Confidential information includes technical, financial and commercial information disclosed by the disclosing party to the receiving party.' },
    { pageNumber: 2, content: 'Governing law: this agreement is governed by the laws of India.' },
  ]);
  const byHeading = Object.fromEntries(r.sections.map(s => [s.heading, s]));
  assert.equal(byHeading['CONFIDENTIAL INFORMATION'].status, 'PRESENT');
  assert.equal(byHeading['CONFIDENTIAL INFORMATION'].pageNumber, 1);
  assert.notEqual(byHeading['GOVERNING LAW'].status, 'MISSING');
  assert.equal(byHeading.PURPOSE.status, 'MISSING');
  assert.equal(r.summary.total, 3);
});

// ─── Calendar (.ics) ────────────────────────────────────────────────────────
test('ics output is RFC 5545 shaped, escaped and folded', () => {
  const ics = buildIcs('Legal Buddy — NDA', [{ uid: 'o1', date: '2027-03-15', summary: 'Payment, due; now', description: 'Line 1\nLine 2 '.repeat(20) }], new Date('2026-11-06T00:00:00Z'));
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20270315'));
  assert.ok(ics.includes('DTEND;VALUE=DATE:20270316'));
  assert.ok(ics.includes('SUMMARY:Payment\\, due\\; now'));
  for (const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75, `line too long: ${line.length}`);
  assert.equal(escapeIcsText('a\nb'), 'a\\nb');
  assert.equal(foldLine('x'.repeat(10)), 'x'.repeat(10));
});

test('explicit dates are parsed, relative periods are not', () => {
  assert.equal(parseExplicitDate('due on March 15, 2027'), '2027-03-15');
  assert.equal(parseExplicitDate('on 5th April 2027'), '2027-04-05');
  assert.equal(parseExplicitDate('2027-12-31'), '2027-12-31');
  assert.equal(parseExplicitDate('15/08/2027'), '2027-08-15', 'Indian DD/MM/YYYY');
  assert.equal(parseExplicitDate('31/02/2027'), null, 'invalid calendar date');
  assert.equal(parseExplicitDate('within 30 days of invoice'), null);
});

test('reminder dates use the Indian calendar day', () => {
  assert.equal(todayInIndia(new Date('2026-11-05T20:00:00Z')), '2026-11-06');
  assert.equal(todayInIndia(new Date('2026-11-05T10:00:00Z')), '2026-11-05');
});

// ─── Evaluation benchmark ──────────────────────────────────────────────────
test('metrics are computed correctly', () => {
  assert.deepEqual(toMetrics({ tp: 3, fp: 1, fn: 2 }), { tp: 3, fp: 1, fn: 2, precision: 0.75, recall: 0.6, f1: 0.667 });
  assert.equal(toMetrics({ tp: 0, fp: 0, fn: 0 }).precision, null);
});

test('the labelled benchmark runs end to end and reports per-category metrics', () => {
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'evaluations');
  const fixture = JSON.parse(fs.readFileSync(path.join(dir, 'clause-cases.json'), 'utf8'));
  const r = runClauseBenchmark(fixture.cases);
  assert.equal(r.cases, fixture.cases.length);
  assert.equal(r.rows.length, fixture.cases.length);
  const totalExpected = fixture.cases.reduce((s: number, c: any) => s + c.clauses.length, 0);
  assert.equal(r.clauseDetection.overall.tp + r.clauseDetection.overall.fn, totalExpected, 'every label is counted once');
  assert.ok(r.clauseDetection.byCategory.length > 0);
});

// ─── Clause review consent ─────────────────────────────────────────────────
test('lawyer clause review needs both consents on a live request', () => {
  const ok = { status: 'ACCEPTED', sharedDocumentId: 'd', documentShareConsentAt: new Date(), documentShareRevokedAt: null, analysisShareConsentAt: new Date() };
  assert.equal(canLawyerReviewAnalysis(ok), true);
  assert.equal(canLawyerReviewAnalysis({ ...ok, analysisShareConsentAt: null }), false);
  assert.equal(canLawyerReviewAnalysis({ ...ok, documentShareRevokedAt: new Date() }), false);
  assert.equal(canLawyerReviewAnalysis({ ...ok, status: 'REJECTED' }), false);
  assert.equal(clauseReviewSchema.safeParse({ clauseFindingId: 'x', comment: 'hi' }).success, false);
  assert.equal(clauseReviewSchema.safeParse({ clauseFindingId: '7d0f8f5e-5f2b-4c39-9a51-0d6d1b0c4f11', comment: 'ok', verdict: 'APPROVE_ALL' }).success, false);
  const create = consultationCreateSchema.safeParse({
    lawyerId: '7d0f8f5e-5f2b-4c39-9a51-0d6d1b0c4f11', contactName: 'A B', contactPhone: '+91 98765 43210', contactEmail: 'a@b.co',
    description: 'A sufficiently long description of the issue.', mode: 'ONLINE', preferredDate: '2030-01-01', preferredTime: '10:00',
  });
  assert.ok(create.success);
  assert.equal(create.data.analysisShareConsent, false, 'analysis sharing is off unless explicitly chosen');
});
