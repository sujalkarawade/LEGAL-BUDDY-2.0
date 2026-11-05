/**
 * Rule-based checks of contract text against selected provisions of Indian law.
 *
 * These are FLAGS FOR REVIEW, not legal conclusions: a regex cannot decide whether a clause is
 * enforceable. Every rule cites the provision it is based on and explains why the text was
 * flagged, so a lawyer can verify it. The rules were written against the statutes as commonly
 * cited; have a qualified reviewer confirm the wording before relying on them.
 */

export type ComplianceSeverity = 'IMPORTANT' | 'REVIEW' | 'INFO';

export interface ComplianceFinding {
  ruleId: string;
  title: string;
  statute: string;
  provision: string;
  severity: ComplianceSeverity;
  whyFlagged: string;
  guidance: string;
  excerpt: string | null;
  pageNumber: number | null;
  /** Legal Buddy Connect specialization slug relevant to this issue. */
  specialization: string;
}

export interface ComplianceResult {
  findings: ComplianceFinding[];
  rulesEvaluated: number;
  disclaimer: string;
}

export const COMPLIANCE_DISCLAIMER =
  'These are automated, rule-based flags to help you decide what to ask a lawyer about. They are not legal advice and do not '
  + 'determine whether any clause is valid or enforceable. Statutes are amended over time; confirm the current position with a qualified advocate.';

interface PageText { pageNumber: number; content: string }

function pageMap(fullText: string): PageText[] {
  const marker = /---PAGE_(\d+)---/g;
  const marks: Array<{ page: number; index: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = marker.exec(fullText)) !== null) marks.push({ page: Number(m[1]), index: m.index });
  if (!marks.length) return [{ pageNumber: 1, content: fullText }];
  return marks.map((mk, i) => ({
    pageNumber: mk.page,
    content: fullText.slice(mk.index, i + 1 < marks.length ? marks[i + 1].index : fullText.length).replace(/---PAGE_\d+---/g, ' '),
  }));
}

/** Returns the sentence around the first match, with its page number. */
function findSentence(pages: PageText[], pattern: RegExp): { excerpt: string; pageNumber: number } | null {
  for (const page of pages) {
    const re = new RegExp(pattern.source, pattern.flags.replace('g', ''));
    const match = re.exec(page.content);
    if (!match) continue;
    const text = page.content;
    const start = Math.max(text.lastIndexOf('.', match.index) + 1, text.lastIndexOf('\n', match.index) + 1, 0);
    const endDot = text.indexOf('.', match.index + match[0].length);
    const end = endDot === -1 ? Math.min(text.length, match.index + 400) : Math.min(endDot + 1, match.index + 500);
    const excerpt = text.slice(start, end).replace(/\s+/g, ' ').trim();
    return { excerpt: excerpt.length > 420 ? `${excerpt.slice(0, 420)}…` : excerpt, pageNumber: page.pageNumber };
  }
  return null;
}

const has = (text: string, pattern: RegExp) => pattern.test(text);

interface Rule {
  id: string;
  title: string;
  statute: string;
  provision: string;
  severity: ComplianceSeverity;
  specialization: string;
  guidance: string;
  /** Returns a reason when the rule applies; `evidence` locates the excerpt shown to the user. */
  test: (lower: string) => { why: string; evidence?: RegExp } | null;
}

const NON_COMPETE = /\b(non[-\s]?compet\w*|shall not[^.]{0,120}\b(engage|compete|carry on|be employed|join|solicit)\b[^.]{0,120}\b(business|competitor|similar))/i;
const POST_TERM = /\b(after|following|post|subsequent to|upon)\s+(the\s+)?(termination|expiry|expiration|cessation|end)\b|\bfor a period of\s+\w+\s*(\(\d+\)\s*)?(months?|years?)\s+(after|following|from)\b/i;

export const INDIAN_LAW_RULES: Rule[] = [
  {
    id: 'ICA_S27_RESTRAINT_OF_TRADE',
    title: 'Non-compete that continues after the contract ends',
    statute: 'Indian Contract Act, 1872',
    provision: 'Section 27 — agreements in restraint of trade',
    severity: 'IMPORTANT',
    specialization: 'employment-labour-law',
    guidance: 'Section 27 makes agreements that restrain a person from a lawful profession, trade or business void, subject to a narrow '
      + 'exception for the sale of goodwill. Indian courts have generally not enforced post-termination non-competes in employment, '
      + 'while restrictions during the term, and confidentiality or non-solicitation covenants, are treated differently. Ask a lawyer how this applies.',
    test: lower => {
      // The post-termination wording must be near the restriction, not anywhere in the contract.
      const all = new RegExp(NON_COMPETE.source, 'gi');
      let m: RegExpExecArray | null;
      while ((m = all.exec(lower)) !== null) {
        const window = lower.slice(Math.max(0, m.index - 250), m.index + m[0].length + 350);
        if (POST_TERM.test(window)) {
          return { why: 'A non-compete style restriction appears next to wording that extends it beyond termination or expiry.', evidence: NON_COMPETE };
        }
      }
      return null;
    },
  },
  {
    id: 'ICA_S74_PENALTY',
    title: 'Penalty or liquidated damages clause',
    statute: 'Indian Contract Act, 1872',
    provision: 'Section 74 — compensation for breach where a penalty is stipulated',
    severity: 'REVIEW',
    specialization: 'contract-law',
    guidance: 'Under Section 74 the stated amount works as an upper limit: a court awards reasonable compensation not exceeding the '
      + 'amount named, whether it is called a penalty or liquidated damages. Check that the figure is a genuine pre-estimate of loss.',
    test: lower => {
      const re = /\b(liquidated damages|penalty|penalties|forfeit(ure|ed)?|by way of damages)\b/i;
      return has(lower, re) ? { why: 'The contract fixes a penalty, forfeiture or liquidated damages amount for breach.', evidence: re } : null;
    },
  },
  {
    id: 'ICA_S28_RESTRAINT_OF_PROCEEDINGS',
    title: 'Clause limiting the right to go to court or the time to claim',
    statute: 'Indian Contract Act, 1872',
    provision: 'Section 28 — agreements in restraint of legal proceedings',
    severity: 'IMPORTANT',
    specialization: 'civil-law',
    guidance: 'Section 28 makes void an agreement that absolutely restricts a party from enforcing rights through ordinary legal '
      + 'proceedings, limits the time to enforce them, or extinguishes rights on expiry of a specified period. Arbitration agreements '
      + 'are an express exception. A lawyer should confirm whether this clause falls within the exceptions.',
    test: lower => {
      const re = /\b(waives?|waiver of)\b[^.]{0,80}\bright[^.]{0,40}\b(sue|legal proceedings?|approach (any )?court|litigat\w*)|\bshall not\b[^.]{0,60}\b(sue|institute|commence|file)\b[^.]{0,60}\b(proceedings?|suit|claim|action)|\b(claims?|suits?|actions?)\b[^.]{0,60}\b(must|shall) be (brought|filed|commenced|made) within\s+\w+/i;
      return has(lower, re) ? { why: 'The text appears to waive the right to sue or to shorten the period within which claims may be brought.', evidence: re } : null;
    },
  },
  {
    id: 'ACA_ARBITRATION_SEAT',
    title: 'Arbitration clause without a clear seat or venue',
    statute: 'Arbitration and Conciliation Act, 1996',
    provision: 'Section 20 — place of arbitration (with Sections 10–11 on arbitrators)',
    severity: 'REVIEW',
    specialization: 'arbitration-dispute-resolution',
    guidance: 'The seat decides which courts supervise the arbitration. If the seat, venue or number/appointment of arbitrators is '
      + 'unclear, disputes about the arbitration itself can arise. Consider stating the seat (city), language, rules and appointment procedure.',
    test: lower => {
      const arb = /\barbitrat(ion|or|ors|e)\b/i;
      if (!has(lower, arb)) return null;
      const seat = /\b(seat|venue|place) of (the )?arbitration\b|\barbitration shall be (held|conducted) (at|in)\b|\bseated in\b/i;
      return has(lower, seat) ? null : { why: 'Arbitration is mentioned, but no seat, venue or place of arbitration was found.', evidence: arb };
    },
  },
  {
    id: 'DPDP_PERSONAL_DATA',
    title: 'Personal data handled without data-protection terms',
    statute: 'Digital Personal Data Protection Act, 2023',
    provision: 'Obligations of data fiduciaries and processors (incl. Sections 4–8)',
    severity: 'REVIEW',
    specialization: 'cyber-law',
    guidance: 'If one party processes personal data for the other, the contract should cover purpose limitation, security safeguards, '
      + 'breach notification, retention/erasure and the processor acting only on instructions. Have a cyber-law specialist review it.',
    test: lower => {
      const data = /\b(personal data|personal information|customer data|employee data|sensitive (personal )?data|aadhaar|biometric)\b/i;
      if (!has(lower, data)) return null;
      const terms = /\b(data protection|digital personal data protection|dpdp|data fiduciary|data processor|privacy polic|breach notification|security safeguards?)\b/i;
      return has(lower, terms) ? null : { why: 'The contract refers to personal data but no data-protection obligations were found.', evidence: data };
    },
  },
  {
    id: 'STAMP_DUTY',
    title: 'Stamp duty not mentioned',
    statute: 'Indian Stamp Act, 1899 and State Stamp Acts',
    provision: 'Section 35 — instruments not duly stamped are inadmissible in evidence',
    severity: 'INFO',
    specialization: 'property-real-estate-law',
    guidance: 'Most agreements must be stamped under the applicable State Stamp Act (rates differ by state and instrument). An instrument '
      + 'that is not duly stamped cannot be admitted in evidence until the deficient duty and penalty are paid. Confirm the correct stamp duty.',
    // Devanagari is outside \b's ASCII word definition, so मुद्रांक (stamp) is matched without boundaries.
    test: lower => (has(lower, /\b(stamp duty|stamp paper|e-?stamp\w*|duly stamped|stamped)\b|मुद्रांक/i)
      ? null
      : { why: 'No reference to stamp duty, stamp paper or e-stamping was found in the text.' }),
  },
  {
    id: 'ICA_S23_UNLAWFUL_OBJECT',
    title: 'Possible unlawful consideration or object',
    statute: 'Indian Contract Act, 1872',
    provision: 'Section 23 — consideration or object that is unlawful or opposed to public policy',
    severity: 'IMPORTANT',
    specialization: 'contract-law',
    guidance: 'An agreement whose object or consideration is forbidden by law, fraudulent or opposed to public policy is void. '
      + 'The wording detected here may be innocent in context; a lawyer should check it.',
    test: lower => {
      const re = /\b(bribe|kickback|illegal gratification|unaccounted cash|in cash only to avoid|evade (tax|stamp duty)|off the books)\b/i;
      return has(lower, re) ? { why: 'Wording associated with unlawful consideration (e.g. bribes, evasion of tax or duty) was detected.', evidence: re } : null;
    },
  },
  {
    id: 'GOVERNING_LAW_MISSING',
    title: 'No governing law or jurisdiction clause',
    statute: 'Code of Civil Procedure, 1908',
    provision: 'Sections 16–20 — place of suing (jurisdiction)',
    severity: 'INFO',
    specialization: 'civil-law',
    guidance: 'Without a governing-law and jurisdiction clause, the competent court is decided by the general rules on where the cause '
      + 'of action arose or the defendant resides. Parties may choose one of the courts that already has jurisdiction.',
    test: lower => (has(lower, /\b(governing law|governed by|laws of india|jurisdiction|courts? (at|of|in))\b/i)
      ? null
      : { why: 'No governing law or court jurisdiction wording was found.' }),
  },
];

export function runIndianLawChecks(fullText: string | null | undefined): ComplianceResult {
  const text = (fullText || '').trim();
  if (text.length < 40) return { findings: [], rulesEvaluated: 0, disclaimer: COMPLIANCE_DISCLAIMER };
  const lower = text.replace(/---PAGE_\d+---/g, ' ').replace(/\s+/g, ' ').toLowerCase();
  const pages = pageMap(text);
  const order: Record<ComplianceSeverity, number> = { IMPORTANT: 0, REVIEW: 1, INFO: 2 };

  const findings = INDIAN_LAW_RULES.flatMap(rule => {
    const hit = rule.test(lower);
    if (!hit) return [];
    const located = hit.evidence ? findSentence(pages, hit.evidence) : null;
    return [{
      ruleId: rule.id, title: rule.title, statute: rule.statute, provision: rule.provision, severity: rule.severity,
      whyFlagged: hit.why, guidance: rule.guidance, excerpt: located?.excerpt ?? null, pageNumber: located?.pageNumber ?? null,
      specialization: rule.specialization,
    }];
  }).sort((a, b) => order[a.severity] - order[b.severity]);

  return { findings, rulesEvaluated: INDIAN_LAW_RULES.length, disclaimer: COMPLIANCE_DISCLAIMER };
}
