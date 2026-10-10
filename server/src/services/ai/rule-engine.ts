import {
  ContractSummaryResult,
  ClauseFindingResult,
  CompletenessItemResult,
  ObligationResult,
  ChatAnswerResult,
} from './ai-types.js';

interface PageMap {
  pageNumber: number;
  content: string;
}

export class RuleEngineService {
  /**
   * Parse page markers in text to map character offsets to page numbers.
   */
  public static parsePageMap(fullText: string): PageMap[] {
    const pageRegex = /---PAGE_(\d+)---/g;
    const pages: PageMap[] = [];
    let match: RegExpExecArray | null;
    const indices: { page: number; index: number }[] = [];

    while ((match = pageRegex.exec(fullText)) !== null) {
      indices.push({ page: parseInt(match[1], 10), index: match.index });
    }

    if (indices.length === 0) {
      return [{ pageNumber: 1, content: fullText }];
    }

    for (let i = 0; i < indices.length; i++) {
      const pageNum = indices[i].page;
      const start = indices[i].index;
      const end = i + 1 < indices.length ? indices[i + 1].index : fullText.length;
      pages.push({
        pageNumber: pageNum,
        content: fullText.substring(start, end).replace(/---PAGE_\d+---/g, ''),
      });
    }

    return pages;
  }

  public static findPageForExcerpt(excerpt: string, pages: PageMap[]): number {
    const cleanExcerpt = excerpt.slice(0, 80).trim().toLowerCase();
    for (const p of pages) {
      if (p.content.toLowerCase().includes(cleanExcerpt)) {
        return p.pageNumber;
      }
    }
    return 1;
  }

  /**
   * Deterministic Contract Summarizer
   */
  static generateSummary(fullText: string, filename: string): ContractSummaryResult {
    const clean = fullText.replace(/---PAGE_\d+---/g, ' ');
    const lower = clean.toLowerCase();

    // 1. Detect Contract Type
    let contractType = 'General Commercial Agreement';
    if (lower.includes('non-disclosure') || lower.includes('confidentiality agreement') || lower.includes(' nda ')) {
      contractType = 'Non-Disclosure Agreement (NDA)';
    } else if (lower.includes('करारनामा') || lower.includes('agreement for sale') || lower.includes('खरेदी खत') || lower.includes('साठेखत')) {
      contractType = 'Agreement for Sale / करारनामा (Real Estate)';
    } else if (lower.includes('सूची क्र. दोन') || lower.includes('index no. ii') || lower.includes('सूची क्र. २') || lower.includes('पावती')) {
      contractType = 'Sub-Registrar Registration / पावती & सूची क्र. २';
    } else if (lower.includes('master services agreement') || lower.includes('msa') || lower.includes('service agreement')) {
      contractType = 'Master Services Agreement (MSA)';
    } else if (lower.includes('employment agreement') || lower.includes('offer letter') || lower.includes('employment contract')) {
      contractType = 'Employment Agreement';
    } else if (lower.includes('independent contractor') || lower.includes('consulting agreement')) {
      contractType = 'Independent Contractor Agreement';
    } else if (lower.includes('lease agreement') || lower.includes('tenancy') || lower.includes('भाडेकरार') || lower.includes('लिव्ह अँड लायसन्स')) {
      contractType = 'Lease / Tenancy Agreement (भाडेकरार)';
    } else if (lower.includes('license agreement') || lower.includes('software license') || lower.includes('saas agreement')) {
      contractType = 'Software / SaaS License Agreement';
    }

    // 2. Detect Parties
    let parties = 'Not explicitly defined in introductory clauses';
    const partiesMatch = clean.match(/(?:by and between|between)\s+([A-Za-z0-9\s.,&'-]+?)(?:\s*\([^)]*\))?\s*(?:and|&)\s+([A-Za-z0-9\s.,&'-]+?)(?:\s*\([^)]*\))?(?:\.|\n|\r|;|\(|each)/i);
    const marathiPartiesMatch = clean.match(/(?:पक्षकाराचे नाव|सादर करणाराचे नाव)[:\s]+([^\n\r]+)/i);
    if (partiesMatch) {
      const p1 = partiesMatch[1].replace(/["']/g, '').trim();
      const p2 = partiesMatch[2].replace(/["']/g, '').trim();
      parties = `Party 1: ${p1}\nParty 2: ${p2}`;
    } else if (marathiPartiesMatch) {
      parties = `Parties (नोंदणी पक्षकार): ${marathiPartiesMatch[1].trim()}`;
    } else {
      const clientMatch = clean.match(/(?:client|employer|disclosing party|owner|promoter)[:\s]+([^\n\r.]+)/i);
      const vendorMatch = clean.match(/(?:service provider|contractor|employee|purchaser|receiving party)[:\s]+([^\n\r.]+)/i);
      if (clientMatch || vendorMatch) {
        parties = `First Party: ${clientMatch ? clientMatch[1].trim() : 'Unspecified'}\nSecond Party: ${vendorMatch ? vendorMatch[1].trim() : 'Unspecified'}`;
      }
    }

    // 3. Purpose
    let purpose = 'Not found in document';
    const purposeMatch = clean.match(/(?:purpose|recitals|whereas|दस्त ऐवजाचा प्रकार|विलेखाचा प्रकार)[\s\S]{1,50}?[:.]\s*([^\n\r]+(?:\n[^\n\r]+)?)/i);
    if (purposeMatch) {
      purpose = purposeMatch[1].trim().slice(0, 300);
    } else {
      const firstSection = clean.slice(0, 500).split(/\n\s*\n/)[0];
      if (firstSection) purpose = `Agreement preamble: ${firstSection.trim().slice(0, 250)}...`;
    }

    // 4. Effective Date & End Date
    let effectiveDate = 'Not found in document';
    const effMatch = clean.match(/(?:effective date|dated as of|commencing on|entered into on|दिनांक)[:\s]+([A-Za-z0-9, /.-]{4,30})/i);
    if (effMatch) effectiveDate = effMatch[1].trim();

    let endDate = 'Not explicitly fixed (Term-based or notice-dependent)';
    const endMatch = clean.match(/(?:expiration date|end date|shall expire on|shall terminate on)[:\s]+([A-Za-z0-9, ]{4,30})/i);
    if (endMatch) endDate = endMatch[1].trim();

    // 5. Payment Terms
    let paymentTerms = 'Not found in document';
    const marathiPaymentMatch = clean.match(/(?:मोबदला|बाजार मुल्य|मुद्रांक शुल्क|भरलेले मुद्रांक|रक्कम)[:\s]+([^\n\r.]+)/i);
    const payMatch = clean.match(/(?:fees?|payment|compensation|consideration)[\s\S]{1,60}?(?:shall pay|fee of|sum of|invoices)[\s\S]{1,250}?\./i);
    if (marathiPaymentMatch) {
      paymentTerms = `Consideration / Stamp Duty: ${marathiPaymentMatch[0].trim()}`;
    } else if (payMatch) {
      paymentTerms = payMatch[0].trim().replace(/\s+/g, ' ');
    } else if (clean.match(/\$\s*[\d,]+|\bINR\s*[\d,]+|\bUSD\s*[\d,]+|Rs\.?\s*[\d,]+/i)) {
      const currencyMatch = clean.match(/[^\n\r.]{0,80}(?:\$|INR|USD|Rs\.?)\s*[\d,]+[^\n\r.]*/i);
      if (currencyMatch) paymentTerms = currencyMatch[0].trim();
    }

    // 6. Responsibilities
    let responsibilities = 'Not found in document';
    const respMatch = clean.match(/(?:obligations?|duties|scope of services|responsibilities)[\s\S]{1,60}?[:.]\s*([^\n\r]+(?:\n[^\n\r]+){1,3})/i);
    if (respMatch) {
      responsibilities = respMatch[1].trim().replace(/\s+/g, ' ').slice(0, 400);
    }

    // 7. Termination Conditions
    let terminationConditions = 'Not found in document';
    const termMatch = clean.match(/(?:termination|term and termination)[\s\S]{1,80}?(?:terminate|written notice)[\s\S]{1,300}?\./i);
    if (termMatch) {
      terminationConditions = termMatch[0].trim().replace(/\s+/g, ' ');
    }

    // 8. Confidentiality Terms
    let confidentialityTerms = 'Not found in document';
    const confMatch = clean.match(/(?:confidentiality|non-disclosure|proprietary information)[\s\S]{1,80}?(?:shall not disclose|protect|duty to maintain)[\s\S]{1,300}?\./i);
    if (confMatch) {
      confidentialityTerms = confMatch[0].trim().replace(/\s+/g, ' ');
    }

    // 9. Liability & Indemnity
    let liabilityTerms = 'Not found in document';
    const liabMatch = clean.match(/(?:limitation of liability|indemnification|liability cap)[\s\S]{1,80}?(?:in no event|capped at|shall indemnify)[\s\S]{1,300}?\./i);
    if (liabMatch) {
      liabilityTerms = liabMatch[0].trim().replace(/\s+/g, ' ');
    }

    // 10. Renewal Provisions
    let renewalProvisions = 'Not found in document';
    const renMatch = clean.match(/(?:renewal|automatically renew|extension)[\s\S]{1,80}?(?:renew|successive period|notice)[\s\S]{1,200}?\./i);
    if (renMatch) {
      renewalProvisions = renMatch[0].trim().replace(/\s+/g, ' ');
    }

    // 11. Important Deadlines
    let importantDeadlines = 'Not found in document';
    const deadMatch = clean.match(/[^\n\r.]*?(?:within \d+ days|prior to \d+ days|notice period of \d+ days)[^\n\r.]*\./i);
    if (deadMatch) {
      importantDeadlines = deadMatch[0].trim().replace(/\s+/g, ' ');
    }

    // 12. Missing or Unclear Information
    const missing: string[] = [];
    if (effectiveDate === 'Not found in document') missing.push('Effective Date is not explicitly stated');
    if (paymentTerms === 'Not found in document' && !lower.includes('non-disclosure')) missing.push('Payment terms / Consideration not identified');
    if (terminationConditions === 'Not found in document') missing.push('Clear termination and notice procedure missing');
    if (liabilityTerms === 'Not found in document') missing.push('Limitation of liability or indemnification cap not detected');
    if (!lower.includes('governing law') && !lower.includes('jurisdiction')) missing.push('Governing law and judicial jurisdiction clause omitted');

    const missingInfo = missing.length > 0 ? missing.join('; ') : 'No high-priority structural omissions detected in baseline scan.';

    const rawSummary = `Contract Analysis Summary for ${filename}:\nIdentified as a ${contractType} involving ${parties.replace(/\n/g, ', ')}. The primary purpose is ${purpose}. Effective date: ${effectiveDate}. Termination protocol: ${terminationConditions}. Confidentiality protections: ${confidentialityTerms}.`;

    return {
      contractType,
      parties,
      purpose,
      effectiveDate,
      endDate,
      paymentTerms,
      responsibilities,
      terminationConditions,
      confidentialityTerms,
      liabilityTerms,
      renewalProvisions,
      importantDeadlines,
      missingInfo,
      rawSummary,
      analysisProvider: 'rule_engine',
    };
  }

  /**
   * Deterministic Clause Extractor & Risk Assessor
   */
  static analyzeClauses(fullText: string): ClauseFindingResult[] {
    const pages = this.parsePageMap(fullText);
    const clean = fullText.replace(/---PAGE_\d+---/g, '\n');
    const findings: ClauseFindingResult[] = [];

    // Categories and heuristic patterns
    const patterns = [
      {
        category: 'Confidentiality',
        title: 'Confidentiality & Non-Disclosure Covenants',
        regex: /(?:confidential\s+information|non-disclosure|duty\s+of\s+confidentiality)[\s\S]{1,100}?(?:shall\s+hold|restrict\s+disclosure|protect|degree\s+of\s+care)[\s\S]{1,400}?\./gi,
        explanation: 'Obligates the parties to maintain trade secrets and proprietary data confidential and defines standard handling requirements.',
        riskEvaluator: (excerpt: string) => {
          if (excerpt.toLowerCase().includes('in perpetuity') || excerpt.toLowerCase().includes('survive indefinitely')) {
            return {
              risk: 'Medium' as const,
              concern: 'Confidentiality duty extends perpetually without a standard 2-5 year sunset clause.',
              question: 'Should trade secret protection be separated from general business confidentiality with a standard 3-year term?',
            };
          }
          return {
            risk: 'Low' as const,
            concern: 'Standard bilateral confidentiality protections detected.',
            question: 'Confirm whether authorized disclosures to external advisors and affiliates are adequately permitted.',
          };
        },
      },
      {
        category: 'Termination',
        title: 'Termination for Convenience & Breach Protocol',
        regex: /(?:term\s+and\s+termination|termination\s+for\s+convenience|cure\s+period)[\s\S]{1,100}?(?:terminate|written\s+notice|material\s+breach)[\s\S]{1,400}?\./gi,
        explanation: 'Governs how and when either party can cancel or exit the agreement, including required prior written notice periods.',
        riskEvaluator: (excerpt: string) => {
          const lower = excerpt.toLowerCase();
          if (lower.includes('immediately without notice') || lower.includes('at sole discretion without cause')) {
            return {
              risk: 'High' as const,
              concern: 'Unilateral or immediate termination without a reasonable cure period exposes the service provider/client to operational disruption.',
              question: 'Can a mandatory 30-day notice period and 15-day cure opportunity be negotiated?',
            };
          }
          return {
            risk: 'Medium' as const,
            concern: 'Notice periods should align with delivery milestones to prevent stranded investments.',
            question: 'Is the required notice window realistic for winding down active work in progress?',
          };
        },
      },
      {
        category: 'Liability',
        title: 'Limitation of Liability & Indemnification Cap',
        regex: /(?:limitation\s+of\s+liability|indemnification|aggregate\s+liability)[\s\S]{1,100}?(?:in\s+no\s+event|capped\s+at|shall\s+indemnify|total\s+fees)[\s\S]{1,400}?\./gi,
        explanation: 'Sets the maximum financial damages a party can recover in the event of a dispute or breach of contract.',
        riskEvaluator: (excerpt: string) => {
          const lower = excerpt.toLowerCase();
          if (lower.includes('uncapped') || lower.includes('unlimited liability') || !lower.includes('capped at')) {
            return {
              risk: 'High' as const,
              concern: 'Potential uncapped liability or broad indemnification without an aggregate monetary limit creates significant commercial exposure.',
              question: 'Can liability be capped at the total fees paid or payable in the preceding 12 months?',
            };
          }
          return {
            risk: 'Low' as const,
            concern: 'Financial liability appears capped to contractual fees; standard commercial allocation.',
            question: 'Verify whether gross negligence, willful misconduct, and confidentiality breaches are excluded from the cap.',
          };
        },
      },
      {
        category: 'Payment',
        title: 'Payment Terms, Invoicing & Late Charges',
        regex: /(?:payment\s+terms?|fees\s+and\s+expenses|invoicing)[\s\S]{1,100}?(?:net\s+\d+|shall\s+pay|interest\s+at|within\s+\d+\s+days)[\s\S]{1,400}?\./gi,
        explanation: 'Defines remuneration schedules, invoicing cadence, payment due dates, and interest applied to delinquent accounts.',
        riskEvaluator: (excerpt: string) => {
          const lower = excerpt.toLowerCase();
          if (lower.includes('interest at 2% per month') || lower.includes('collection fees and attorney fees')) {
            return {
              risk: 'Medium' as const,
              concern: 'Aggressive late payment penalty rates (24%+ annualized) or broad collection cost shifting.',
              question: 'Are invoicing approval procedures clearly documented before the payment clock begins running?',
            };
          }
          return {
            risk: 'Low' as const,
            concern: 'Standard commercial payment and milestone terms.',
            question: 'Confirm whether reimbursement for out-of-pocket expenses requires prior written approval.',
          };
        },
      },
      {
        category: 'Intellectual Property',
        title: 'IP Ownership, Work Made for Hire & Licensing',
        regex: /(?:intellectual\s+property|ownership\s+of\s+deliverables|work\s+made\s+for\s+hire)[\s\S]{1,100}?(?:shall\s+belong|assigns?|worldwide\s+right|retains\s+all)[\s\S]{1,400}?\./gi,
        explanation: 'Determines whether the client owns created deliverables or receives a commercial license, and preserves background IP.',
        riskEvaluator: (excerpt: string) => {
          const lower = excerpt.toLowerCase();
          if (lower.includes('assigns all right, title, and interest') && !lower.includes('pre-existing') && !lower.includes('background')) {
            return {
              risk: 'Medium' as const,
              concern: 'Broad IP assignment without explicit reservation of pre-existing background tools and reusable code libraries.',
              question: 'Has a carve-out for pre-existing proprietary intellectual property and tools been included?',
            };
          }
          return {
            risk: 'Low' as const,
            concern: 'Clear delineation of deliverable rights versus vendor background property.',
            question: 'Does the ownership transfer occur only upon final receipt of full payment?',
          };
        },
      },
      {
        category: 'Governing Law',
        title: 'Governing Law & Legal Jurisdiction',
        regex: /(?:governing\s+law|jurisdiction|applicable\s+law)[\s\S]{1,100}?(?:laws\s+of|exclusive\s+jurisdiction|courts\s+in)[\s\S]{1,350}?\./gi,
        explanation: 'Specifies which state or national legal system interprets the contract and where lawsuits or court proceedings must be filed.',
        riskEvaluator: (excerpt: string) => {
          return {
            risk: 'Low' as const,
            concern: 'Standard choice-of-law designation.',
            question: 'Is the designated forum commercially and logistically convenient for both contracting entities?',
          };
        },
      },
      {
        category: 'Dispute Resolution',
        title: 'Dispute Resolution & Arbitration Clause',
        regex: /(?:dispute\s+resolution|arbitration|mediation)[\s\S]{1,100}?(?:arbitrator|rules\s+of|good\s+faith\s+negotiations?)[\s\S]{1,400}?\./gi,
        explanation: 'Requires formal negotiations or private binding arbitration before either party can institute public court litigation.',
        riskEvaluator: (excerpt: string) => {
          return {
            risk: 'Low' as const,
            concern: 'Structured dispute resolution escalation procedure.',
            question: 'Does the clause mandate an informal executive discussion period before escalating to costly arbitration?',
          };
        },
      },
      {
        category: 'Renewal',
        title: 'Automatic Renewal & Term Extension',
        regex: /(?:renewal|automatically\s+renew|successive\s+terms?)[\s\S]{1,100}?(?:renew|unless\s+written\s+notice|prior\s+to\s+expiration)[\s\S]{1,350}?\./gi,
        explanation: 'Dictates whether the contract automatically rolls over into a new annual or multi-year term unless timely cancelled.',
        riskEvaluator: (excerpt: string) => {
          return {
            risk: 'Medium' as const,
            concern: 'Automatic evergreen renewal without a calendar reminder may lock the client into unwanted fee commitments.',
            question: 'What is the exact advance notice deadline required to prevent automatic rollover?',
          };
        },
      },
      {
        category: 'Penalties',
        title: 'Penalties & Liquidated Damages',
        regex: /(?:liquidated\s+damages|penalty|late\s+fee|default\s+charge)[\s\S]{1,100}?(?:shall\s+pay|amount\s+of|fee\s+of)[\s\S]{1,350}?\./gi,
        explanation: 'Pre-determines monetary damages or fines owed in the event of specified delays or performance infractions.',
        riskEvaluator: (excerpt: string) => {
          return {
            risk: 'Needs Review' as const,
            concern: 'Liquidated damage formulas must represent genuine pre-estimates of loss rather than unenforceable punitive penalties.',
            question: 'Have actual financial damages been calibrated to substantiate the pre-agreed figure?',
          };
        },
      },
    ];

    for (const pat of patterns) {
      pat.regex.lastIndex = 0;
      const match = pat.regex.exec(clean);
      if (match) {
        const rawExcerpt = match[0].trim().replace(/\s+/g, ' ');
        const excerpt = rawExcerpt.length > 500 ? rawExcerpt.slice(0, 500) + '...' : rawExcerpt;
        const pageNumber = this.findPageForExcerpt(excerpt, pages);
        const evalResult = pat.riskEvaluator(excerpt);

        findings.push({
          category: pat.category,
          title: pat.title,
          excerpt,
          pageNumber,
          plainLanguageExplanation: pat.explanation,
          riskLevel: evalResult.risk,
          potentialConcern: evalResult.concern,
          reviewQuestion: evalResult.question,
        });
      }
    }

    // If fewer than 2 clauses detected via strict regex, grab general paragraphs
    if (findings.length === 0) {
      const paragraphs = clean.split(/\n\s*\n/).filter((p) => p.trim().length > 60);
      paragraphs.slice(0, 3).forEach((p, idx) => {
        findings.push({
          category: 'General Terms',
          title: `Contract Section ${idx + 1}`,
          excerpt: p.slice(0, 400).trim(),
          pageNumber: 1,
          plainLanguageExplanation: 'Standard contractual provision extracted from document body.',
          riskLevel: 'Needs Review',
          potentialConcern: 'Requires manual verification of operative obligations.',
          reviewQuestion: 'Does this section define clear rights and remedies?',
        });
      });
    }

    return findings;
  }

  /**
   * Deterministic Contract Completeness Checker
   */
  static checkCompleteness(fullText: string, category: string = 'General Commercial Contract'): CompletenessItemResult[] {
    const pages = this.parsePageMap(fullText);
    const clean = fullText.replace(/---PAGE_\d+---/g, ' ').toLowerCase();

    // Standard checklist expectations
    const checklist: Array<{
      expected: string;
      terms: string[];
      ambiguousTerms: string[];
      description: string;
    }> = [
      {
        expected: 'Preamble & Identification of Legal Parties',
        terms: ['between', 'by and between', 'parties', 'disclosing party', 'client', 'service provider'],
        ambiguousTerms: ['agreement', 'signatory'],
        description: 'Identification of legal entity names, addresses, and corporate status of all contracting parties.',
      },
      {
        expected: 'Effective Date & Term / Duration',
        terms: ['effective date', 'commencement date', 'term of this agreement', 'duration'],
        ambiguousTerms: ['date', 'years'],
        description: 'Explicit start date, operative duration, and end or expiration milestones.',
      },
      {
        expected: 'Defined Scope of Services or Purpose',
        terms: ['scope of services', 'purpose', 'recitals', 'deliverables', 'statement of work'],
        ambiguousTerms: ['work', 'services'],
        description: 'Clear description of obligations, deliverables, or business disclosure scope.',
      },
      {
        expected: 'Consideration & Payment Terms',
        terms: ['fees', 'payment terms', 'compensation', 'invoices', 'net 30', 'consideration'],
        ambiguousTerms: ['rates', 'currency', 'price'],
        description: 'Specified monetary amounts, payment intervals, and invoice approval procedures.',
      },
      {
        expected: 'Confidentiality & Non-Disclosure Covenants',
        terms: ['confidential information', 'non-disclosure', 'proprietary information', 'confidentiality'],
        ambiguousTerms: ['secret', 'private'],
        description: 'Protection of proprietary trade secrets, handling standards, and permitted disclosures.',
      },
      {
        expected: 'Termination & Cure Period Procedures',
        terms: ['termination for convenience', 'term and termination', 'notice of termination', 'cure period', 'material breach'],
        ambiguousTerms: ['terminate', 'cancel'],
        description: 'Conditions permitting either party to exit the agreement, including required written notice.',
      },
      {
        expected: 'Limitation of Liability & Indemnification Cap',
        terms: ['limitation of liability', 'indemnification', 'aggregate liability', 'consequential damages'],
        ambiguousTerms: ['damages', 'losses', 'liable'],
        description: 'Financial ceiling capping monetary damages and mutual indemnification protections.',
      },
      {
        expected: 'Intellectual Property Ownership & Licensing',
        terms: ['intellectual property', 'work made for hire', 'ownership of deliverables', 'proprietary rights'],
        ambiguousTerms: ['copyright', 'license', 'patent'],
        description: 'Explicit allocation of ownership in work product vs. pre-existing background IP.',
      },
      {
        expected: 'Governing Law & Legal Jurisdiction',
        terms: ['governing law', 'applicable law', 'exclusive jurisdiction', 'courts of'],
        ambiguousTerms: ['jurisdiction', 'state of'],
        description: 'Designation of the governing state/country laws and competent forum courts.',
      },
      {
        expected: 'Dispute Resolution & Escalation Mechanism',
        terms: ['arbitration', 'dispute resolution', 'mediation', 'informal dispute'],
        ambiguousTerms: ['dispute', 'litigation'],
        description: 'Mandatory negotiation, mediation, or arbitration prior to public court litigation.',
      },
    ];

    const results: CompletenessItemResult[] = [];

    for (const item of checklist) {
      let foundExact = false;
      let matchedTerm = '';

      for (const t of item.terms) {
        if (clean.includes(t)) {
          foundExact = true;
          matchedTerm = t;
          break;
        }
      }

      if (foundExact) {
        // Find excerpt around matched term
        const rawIndex = clean.indexOf(matchedTerm);
        const start = Math.max(0, rawIndex - 50);
        const end = Math.min(clean.length, rawIndex + 250);
        const excerpt = fullText.slice(start, end).replace(/---PAGE_\d+---/g, '').trim();
        const pageNumber = this.findPageForExcerpt(excerpt, pages);

        results.push({
          expectedSection: item.expected,
          detectedTitle: `Detected Clause mentioning "${matchedTerm}"`,
          status: 'FOUND',
          excerpt: excerpt.length > 300 ? excerpt.slice(0, 300) + '...' : excerpt,
          pageNumber,
          reason: `Found operative section containing standard contractual language relating to ${item.expected}.`,
        });
      } else {
        // Check if ambiguous terms exist
        let foundAmbiguous = false;
        for (const at of item.ambiguousTerms) {
          if (clean.includes(at)) {
            foundAmbiguous = true;
            break;
          }
        }

        if (foundAmbiguous) {
          results.push({
            expectedSection: item.expected,
            status: 'NEEDS_REVIEW',
            reason: `Vague or partial terminology detected, but no distinct and comprehensive section for ${item.expected} was identified. Recommend legal counsel review.`,
          });
        } else {
          results.push({
            expectedSection: item.expected,
            status: 'NOT_FOUND',
            reason: `No provisions relating to ${item.expected} were located in the uploaded document text.`,
          });
        }
      }
    }

    return results;
  }

  /**
   * Deterministic Dates & Obligations Extractor
   */
  static extractObligations(fullText: string): ObligationResult[] {
    const pages = this.parsePageMap(fullText);
    const clean = fullText.replace(/---PAGE_\d+---/g, ' ');
    const obligations: ObligationResult[] = [];

    // Search for operative obligation markers: "shall", "must", "agrees to", "will", "within X days"
    const sentences = clean.split(/(?<=[.?!])\s+/);

    for (const s of sentences) {
      const trimmed = s.trim();
      if (trimmed.length < 30 || trimmed.length > 500) continue;

      const lower = trimmed.toLowerCase();

      // 1. Payment deadlines
      if (lower.includes('shall pay') || lower.includes('invoices shall be paid') || lower.includes('net 30') || lower.includes('payment due')) {
        const pageNumber = this.findPageForExcerpt(trimmed, pages);
        let due = 'Net terms specified in clause';
        const dayMatch = trimmed.match(/within\s+(\d+)\s+days/i);
        if (dayMatch) due = `Within ${dayMatch[1]} days of invoice receipt`;

        let party = 'Client / Obligated Party';
        if (lower.includes('client shall pay')) party = 'Client';
        else if (lower.includes('receiving party')) party = 'Receiving Party';

        obligations.push({
          category: 'Payment Deadlines',
          description: trimmed.slice(0, 250),
          responsibleParty: party,
          dueDateOrPeriod: due,
          isCalendarDate: false,
          excerpt: trimmed,
          pageNumber,
          confidence: 'HIGH',
        });
      }

      // 2. Termination Notice Periods
      else if (lower.includes('written notice') && (lower.includes('terminate') || lower.includes('termination'))) {
        const pageNumber = this.findPageForExcerpt(trimmed, pages);
        let notice = 'Advance written notice';
        const noticeMatch = trimmed.match(/(\d+)\s+days['\s]+(?:prior\s+)?written\s+notice/i);
        if (noticeMatch) notice = `${noticeMatch[1]} days prior written notice`;

        obligations.push({
          category: 'Termination Notice Periods',
          description: trimmed.slice(0, 250),
          responsibleParty: 'Either Party',
          dueDateOrPeriod: notice,
          isCalendarDate: false,
          excerpt: trimmed,
          pageNumber,
          confidence: 'HIGH',
        });
      }

      // 3. Renewal and Expiry Deadlines
      else if (lower.includes('renew') || lower.includes('renewal') || lower.includes('expiration date')) {
        const pageNumber = this.findPageForExcerpt(trimmed, pages);
        const calendarMatch = trimmed.match(/(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2}/i);
        
        obligations.push({
          category: 'Renewal & Expiry Dates',
          description: trimmed.slice(0, 250),
          responsibleParty: 'Both Parties',
          dueDateOrPeriod: calendarMatch ? calendarMatch[0] : 'Relative to term anniversary',
          isCalendarDate: !!calendarMatch,
          excerpt: trimmed,
          pageNumber,
          confidence: 'MEDIUM',
        });
      }

      // 4. Delivery or Performance Obligations
      else if ((lower.includes('shall deliver') || lower.includes('shall provide') || lower.includes('agrees to perform')) && !lower.includes('shall pay')) {
        const pageNumber = this.findPageForExcerpt(trimmed, pages);
        obligations.push({
          category: 'Delivery / Performance Obligations',
          description: trimmed.slice(0, 250),
          responsibleParty: lower.includes('service provider') ? 'Service Provider' : 'Contractor / Disclosing Party',
          dueDateOrPeriod: 'As scheduled in milestone timeline',
          isCalendarDate: false,
          excerpt: trimmed,
          pageNumber,
          confidence: 'MEDIUM',
        });
      }

      // Limit to max 12 items to avoid overload
      if (obligations.length >= 10) break;
    }

    return obligations;
  }

  /**
   * Grounded Question & Answer with Strict Evidence Safeguards
   */
  static answerQuestion(
    question: string,
    chunks: Array<{ chunkIndex: number; pageNumber: number; content: string }>
  ): ChatAnswerResult {
    const stopWords = new Set([
      'what', 'which', 'where', 'when', 'who', 'how', 'does', 'this', 'that', 'these', 'those',
      'there', 'their', 'they', 'them', 'the', 'and', 'for', 'with', 'from', 'about', 'into',
      'have', 'has', 'had', 'are', 'was', 'were', 'been', 'being', 'will', 'would', 'shall',
      'should', 'can', 'could', 'may', 'might', 'must', 'any', 'some', 'other', 'all'
    ]);

    const qLower = question.toLowerCase();
    const qTokens = qLower
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !stopWords.has(t));

    // If query was only stop words, treat as empty match
    if (qTokens.length === 0) {
      return {
        answer:
          `Information not found in the uploaded document.\n\n` +
          `Please provide a more specific contract question regarding operative clauses, parties, or obligations.`,
        citations: [],
        isDocumentGrounded: false,
        provider: 'rule_engine',
      };
    }

    // Score chunks using token overlap
    const scoredChunks = chunks.map((chunk) => {
      const contentLower = chunk.content.toLowerCase();
      let matchCount = 0;
      for (const tok of qTokens) {
        if (contentLower.includes(tok)) {
          matchCount += 1;
        }
      }
      return {
        ...chunk,
        score: matchCount / qTokens.length,
      };
    });

    // Sort descending by score
    scoredChunks.sort((a, b) => b.score - a.score);
    const topChunks = scoredChunks.filter((c) => c.score >= 0.25).slice(0, 3);

    // Safeguard: If zero relevant chunks match
    if (topChunks.length === 0) {
      return {
        answer:
          `Information not found in the uploaded document.\n\n` +
          `Legal Buddy scanned all extracted pages of this agreement, but could not locate explicit clauses or terms addressing "${question}".\n\n` +
          `Notice: General legal rules and statutory provisions outside the four corners of this contract are not included in this document-grounded verification. Consult qualified legal counsel for cross-jurisdictional advice.`,
        citations: [],
        isDocumentGrounded: false,
        provider: 'rule_engine',
      };
    }

    // Build grounded response referencing top evidence
    const citations = topChunks.map((c) => ({
      excerpt: c.content.slice(0, 280) + '...',
      pageNumber: c.pageNumber,
      score: Math.round(c.score * 100) / 100,
    }));

    // Synthesize grounded explanation
    const primarySnippet = topChunks[0].content.slice(0, 350).replace(/\s+/g, ' ');
    const pageNum = topChunks[0].pageNumber;

    let answer = `Based on Page ${pageNum} of the uploaded agreement:\n\n` +
      `"${primarySnippet}..."\n\n` +
      `Key Takeaways from the Document:\n` +
      `• The contract explicitly addresses this query on Page ${pageNum}.\n` +
      `• Document facts: The clause stipulates terms as quoted above.\n` +
      `• Review guidance: Please review the exact clause wording to ensure operational compliance.`;

    if (topChunks.length > 1) {
      answer += `\n\nAdditionally, Page ${topChunks[1].pageNumber} provides related context: "${topChunks[1].content.slice(0, 160)}..."`;
    }

    return {
      answer,
      citations,
      isDocumentGrounded: true,
      provider: 'rule_engine',
    };
  }
}
