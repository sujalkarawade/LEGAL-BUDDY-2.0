/**
 * Compares an uploaded contract with one of Legal Buddy's standard templates, section by section.
 * Uses word overlap (how much of the template section's vocabulary appears in the best-matching
 * part of the contract). It shows WHERE wording differs; it cannot judge legal equivalence.
 */

const STOP = new Set(('a an and are as at be been by for from has have herein hereby in into is it its of on or other '
  + 'such that the their then there these this those to under upon was were which will with within without any all '
  + 'shall may must party parties agreement each either per not no than so if').split(' '));

export function tokens(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .replace(/\{\{[^}]+\}\}/g, ' ')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2 && !STOP.has(t) && !/^\d+$/.test(t)),
  );
}

export interface TemplateSection { number: string; heading: string; body: string }

/** Splits a template into numbered sections such as "3. TERM AND TERMINATION". */
export function parseTemplateSections(templateText: string): TemplateSection[] {
  const lines = templateText.split(/\r?\n/);
  const sections: TemplateSection[] = [];
  let current: TemplateSection | null = null;
  for (const line of lines) {
    const heading = line.match(/^\s*(\d{1,2})\.\s+([A-Z][A-Z0-9 &,'/()-]{2,80})\s*$/);
    if (heading) {
      if (current) sections.push(current);
      current = { number: heading[1], heading: heading[2].trim(), body: '' };
    } else if (current) {
      if (/^\s*IN WITNESS WHEREOF/i.test(line)) { sections.push(current); current = null; continue; }
      current.body += `${line}\n`;
    }
  }
  if (current) sections.push(current);
  return sections.map(s => ({ ...s, body: s.body.trim() }));
}

export interface ContractChunk { pageNumber: number; content: string }

export type SectionStatus = 'PRESENT' | 'DIFFERENT_WORDING' | 'MISSING';

export interface SectionComparison {
  number: string;
  heading: string;
  status: SectionStatus;
  coverage: number;
  headingFound: boolean;
  pageNumber: number | null;
  contractExcerpt: string | null;
  missingTerms: string[];
}

export const PRESENT_THRESHOLD = 0.45;
export const PARTIAL_THRESHOLD = 0.2;

export function compareWithTemplate(templateText: string, chunks: ContractChunk[]) {
  const sections = parseTemplateSections(templateText);
  const prepared = chunks.map(c => ({ ...c, tokens: tokens(c.content), lower: c.content.toLowerCase() }));

  const results: SectionComparison[] = sections.map(section => {
    const sectionTokens = tokens(`${section.heading} ${section.body}`);
    const headingWords = [...tokens(section.heading)];
    let best: { coverage: number; chunk: (typeof prepared)[number] | null; headingFound: boolean } = { coverage: 0, chunk: null, headingFound: false };
    for (const chunk of prepared) {
      let shared = 0;
      for (const t of sectionTokens) if (chunk.tokens.has(t)) shared += 1;
      const coverage = sectionTokens.size ? shared / sectionTokens.size : 0;
      const headingFound = headingWords.length > 0 && headingWords.every(w => chunk.tokens.has(w));
      const rank = coverage + (headingFound ? 0.1 : 0);
      if (rank > best.coverage + (best.headingFound ? 0.1 : 0)) best = { coverage, chunk, headingFound };
    }
    const status: SectionStatus = best.coverage >= PRESENT_THRESHOLD || (best.headingFound && best.coverage >= PARTIAL_THRESHOLD)
      ? 'PRESENT'
      : best.coverage >= PARTIAL_THRESHOLD || best.headingFound ? 'DIFFERENT_WORDING' : 'MISSING';
    const missingTerms = best.chunk ? [...sectionTokens].filter(t => !best.chunk!.tokens.has(t)).slice(0, 8) : [...sectionTokens].slice(0, 8);
    let excerpt: string | null = null;
    if (best.chunk && status !== 'MISSING') {
      const anchor = headingWords.length ? best.chunk.lower.indexOf(headingWords[0]) : -1;
      const start = Math.max(0, anchor > -1 ? anchor - 40 : 0);
      excerpt = best.chunk.content.slice(start, start + 320).replace(/\s+/g, ' ').trim();
    }
    return {
      number: section.number,
      heading: section.heading,
      status,
      coverage: Math.round(best.coverage * 100) / 100,
      headingFound: best.headingFound,
      pageNumber: status === 'MISSING' ? null : best.chunk?.pageNumber ?? null,
      contractExcerpt: excerpt,
      missingTerms: status === 'PRESENT' ? [] : missingTerms,
    };
  });

  return {
    sections: results,
    summary: {
      total: results.length,
      present: results.filter(r => r.status === 'PRESENT').length,
      differentWording: results.filter(r => r.status === 'DIFFERENT_WORDING').length,
      missing: results.filter(r => r.status === 'MISSING').length,
    },
    method: `Word-overlap comparison. "Present" means at least ${Math.round(PRESENT_THRESHOLD * 100)}% of the template section's key words appear in one part of the contract; `
      + `"Different wording" means ${Math.round(PARTIAL_THRESHOLD * 100)}–${Math.round(PRESENT_THRESHOLD * 100)}% or the heading only. It does not judge whether the terms are legally equivalent.`,
  };
}
