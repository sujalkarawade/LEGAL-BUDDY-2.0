import bcrypt from 'bcryptjs';
import prisma from './client.js';

async function main() {
  console.log('🌱 Starting Legal Buddy database seeding...');

  // 1. Seed Test Users
  const passwordHash = await bcrypt.hash('Password123!', 10);

  const testUser = await prisma.user.upsert({
    where: { email: 'test@legalbuddy.io' },
    update: {},
    create: {
      email: 'test@legalbuddy.io',
      name: 'Adv. Sarah Jenkins',
      passwordHash,
      role: 'USER',
      organization: 'Apex Legal Partners & Counsel',
    },
  });

  const secondaryUser = await prisma.user.upsert({
    where: { email: 'alex@techcorp.io' },
    update: {},
    create: {
      email: 'alex@techcorp.io',
      name: 'Alex Rivera',
      passwordHash,
      role: 'USER',
      organization: 'TechCorp Solutions Inc.',
    },
  });

  console.log(`👤 Users seeded:`);
  console.log(`   - Primary: ${testUser.email} (Password: Password123!)`);
  console.log(`   - Isolation Test: ${secondaryUser.email} (Password: Password123!)`);

  // 2. Seed Document Templates
  const templates = [
    {
      title: 'Mutual Non-Disclosure Agreement (NDA)',
      category: 'Confidentiality',
      description: 'Standard bilateral non-disclosure agreement to protect confidential and proprietary disclosures between two commercial parties.',
      schemaJson: JSON.stringify([
        { name: 'disclosingParty', label: 'Disclosing Party Legal Name', type: 'text', required: true, placeholder: 'e.g. Acme Innovations Inc.' },
        { name: 'receivingParty', label: 'Receiving Party Legal Name', type: 'text', required: true, placeholder: 'e.g. Zenith Global Ltd.' },
        { name: 'effectiveDate', label: 'Effective Date', type: 'date', required: true, placeholder: 'YYYY-MM-DD' },
        { name: 'termYears', label: 'Confidentiality Period (Years)', type: 'number', required: true, placeholder: 'e.g. 3' },
        { name: 'governingLaw', label: 'Governing Law & Jurisdiction', type: 'text', required: true, placeholder: 'e.g. State of Delaware / High Court of Delhi' },
        { name: 'purpose', label: 'Business Purpose of Disclosure', type: 'textarea', required: true, placeholder: 'e.g. Evaluating potential strategic partnership in cloud analytics' },
        { name: 'noticePeriodDays', label: 'Notice Period for Return of Materials (Days)', type: 'number', required: false, placeholder: 'e.g. 15' },
      ]),
      templateText: `MUTUAL NON-DISCLOSURE AGREEMENT

[DRAFT — FOR REVIEW PURPOSES ONLY. NOT LEGAL ADVICE.]

This Mutual Non-Disclosure Agreement ("Agreement") is entered into on {{effectiveDate}} ("Effective Date") by and between:

PARTIES:
1. {{disclosingParty}}, having its registered office as indicated in corporate records ("Party A"); and
2. {{receivingParty}}, having its registered office as indicated in corporate records ("Party B").
(Each individually referred to as a "Party" and collectively as the "Parties").

1. PURPOSE
The Parties wish to explore and evaluate a prospective commercial engagement involving {{purpose}} (the "Authorized Purpose"). In connection therewith, each Party may disclose to the other certain proprietary and non-public information.

2. CONFIDENTIAL INFORMATION
"Confidential Information" shall include all technical, financial, commercial, legal, product, and operational information disclosed directly or indirectly by one Party ("Disclosing Party") to the other ("Receiving Party"), whether orally, in writing, electronically, or by inspection of tangible items, marked or designated as confidential or which reasonable persons would understand to be proprietary.

3. OBLIGATIONS OF CONFIDENTIALITY
The Receiving Party agrees to:
(a) Protect and preserve the confidentiality of the Confidential Information using the same degree of care it uses for its own confidential information, but in no event less than a reasonable degree of care;
(b) Restrict disclosure strictly to its employees, directors, advisors, or affiliates who have a strict need-to-know for the Authorized Purpose and are bound by confidentiality covenants no less stringent than those herein;
(c) Not copy, reverse-engineer, or commercially exploit any Confidential Information without prior written consent.

4. EXCLUSIONS
Confidential Information does not include information that:
(a) Is or becomes publicly known without breach of this Agreement;
(b) Was already in the lawful possession of the Receiving Party prior to disclosure;
(c) Is received from a third party free of confidentiality restrictions; or
(d) Is independently developed by the Receiving Party without reference to the Disclosing Party's Confidential Information.

5. TERM AND TERMINATION
This Agreement and the duty to maintain confidentiality shall remain in full force and effect for a period of {{termYears}} year(s) from the Effective Date. Upon written request, the Receiving Party shall promptly return or certify destruction of all confidential materials within {{noticePeriodDays}} days.

6. GOVERNING LAW AND DISPUTE RESOLUTION
This Agreement shall be governed by, interpreted, and construed in accordance with the substantive laws of {{governingLaw}}, without regard to conflict of laws principles. The Parties submit to the exclusive jurisdiction of the competent courts in {{governingLaw}}.

IN WITNESS WHEREOF, the authorized representatives of the Parties have executed this Agreement as of the Effective Date.

Party A: {{disclosingParty}}
Authorized Signatory: ________________________
Title: ______________________________________

Party B: {{receivingParty}}
Authorized Signatory: ________________________
Title: ______________________________________`
    },
    {
      title: 'Master Services Agreement (MSA)',
      category: 'Commercial Contracts',
      description: 'Comprehensive agreement establishing commercial terms, deliverable milestones, warranties, payment obligations, and liability caps for service providers and clients.',
      schemaJson: JSON.stringify([
        { name: 'clientName', label: 'Client Legal Entity', type: 'text', required: true, placeholder: 'e.g. Nexus Enterprises Corp.' },
        { name: 'serviceProvider', label: 'Service Provider / Vendor Legal Name', type: 'text', required: true, placeholder: 'e.g. Apex Software Solutions LLC' },
        { name: 'effectiveDate', label: 'Effective Date', type: 'date', required: true, placeholder: 'YYYY-MM-DD' },
        { name: 'servicesDescription', label: 'Scope of Services Overview', type: 'textarea', required: true, placeholder: 'e.g. Enterprise application architecture, cloud deployment, and ongoing maintenance' },
        { name: 'feeAmount', label: 'Contract Fee / Retainer Amount', type: 'text', required: true, placeholder: 'e.g. $15,000 USD monthly / $120,000 Total' },
        { name: 'paymentTermDays', label: 'Payment Net Terms (Days)', type: 'number', required: true, placeholder: 'e.g. 30' },
        { name: 'terminationNoticeDays', label: 'Termination for Convenience Notice (Days)', type: 'number', required: true, placeholder: 'e.g. 30' },
        { name: 'liabilityCap', label: 'Limitation of Liability Cap', type: 'text', required: true, placeholder: 'e.g. Total fees paid in prior 12 months' },
        { name: 'governingLaw', label: 'Governing Law', type: 'text', required: true, placeholder: 'e.g. State of New York' },
      ]),
      templateText: `MASTER SERVICES AGREEMENT

[DRAFT — FOR REVIEW PURPOSES ONLY. NOT LEGAL ADVICE.]

This Master Services Agreement ("Agreement") is dated as of {{effectiveDate}} ("Effective Date") by and between:

CLIENT: {{clientName}}
AND
SERVICE PROVIDER: {{serviceProvider}}

1. SERVICES AND STATEMENTS OF WORK
Service Provider agrees to provide Client with the professional services described herein:
{{servicesDescription}}.
Specific milestones, deliverables, and acceptance criteria may be detailed in subsequent Statements of Work ("SOW").

2. FEES AND PAYMENT TERMS
Client shall pay Service Provider the agreed consideration of {{feeAmount}}. Invoices shall be submitted monthly and paid within {{paymentTermDays}} days of receipt ("Net {{paymentTermDays}}"). Late payments shall accrue interest at 1.5% per month or the maximum statutory rate permitted by law.

3. TERM AND TERMINATION
Either Party may terminate this Agreement for convenience by providing at least {{terminationNoticeDays}} days' prior written notice to the other Party. Either Party may terminate immediately upon written notice if the other Party materially breaches any term and fails to cure such breach within fifteen (15) days of notice.

4. INTELLECTUAL PROPERTY
Unless otherwise agreed in a specific SOW, all deliverables created by Service Provider specifically for Client under this Agreement shall be deemed "work made for hire", and upon full payment of fees, Client shall own all worldwide right, title, and interest in such deliverables.

5. LIMITATION OF LIABILITY
TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL EITHER PARTY BE LIABLE FOR INDIRECT, SPECIAL, INCIDENTAL, OR CONSEQUENTIAL DAMAGES. EACH PARTY'S TOTAL AGGREGATE LIABILITY SHALL BE CAPPED AT: {{liabilityCap}}.

6. GOVERNING LAW
This Agreement shall be construed, interpreted, and enforced in accordance with the laws of {{governingLaw}}.

Party: {{clientName}}
Signature: __________________________
Date: _______________________________

Party: {{serviceProvider}}
Signature: __________________________
Date: _______________________________`
    },
    {
      title: 'Standard Employment Agreement',
      category: 'Employment & HR',
      description: 'Formal employment contract detailing job title, compensation, benefits, probationary period, intellectual property assignment, and termination clauses.',
      schemaJson: JSON.stringify([
        { name: 'companyName', label: 'Company / Employer Name', type: 'text', required: true, placeholder: 'e.g. Horizon Fintech Labs Inc.' },
        { name: 'employeeName', label: 'Employee Full Legal Name', type: 'text', required: true, placeholder: 'e.g. Robert M. Vance' },
        { name: 'jobTitle', label: 'Position / Job Title', type: 'text', required: true, placeholder: 'e.g. Senior Principal Software Engineer' },
        { name: 'startDate', label: 'Start Date', type: 'date', required: true, placeholder: 'YYYY-MM-DD' },
        { name: 'annualSalary', label: 'Annual Base Compensation', type: 'text', required: true, placeholder: 'e.g. $145,000 USD per annum' },
        { name: 'probationMonths', label: 'Probationary Period (Months)', type: 'number', required: false, placeholder: 'e.g. 3' },
        { name: 'noticePeriodWeeks', label: 'Resignation / Notice Period (Weeks)', type: 'number', required: true, placeholder: 'e.g. 4' },
        { name: 'workLocation', label: 'Location / Remote Arrangement', type: 'text', required: true, placeholder: 'e.g. Remote / Headquarters in San Francisco' },
        { name: 'governingLaw', label: 'Governing Jurisdiction', type: 'text', required: true, placeholder: 'e.g. State of California' },
      ]),
      templateText: `EMPLOYMENT AGREEMENT

[DRAFT — FOR REVIEW PURPOSES ONLY. NOT LEGAL ADVICE.]

This Employment Agreement ("Agreement") is made effective on {{startDate}} between:

EMPLOYER: {{companyName}} ("Company")
AND
EMPLOYEE: {{employeeName}} ("Employee")

1. POSITION AND DUTIES
The Company hereby employs Employee in the capacity of {{jobTitle}}. Employee shall perform all duties reasonably assigned to this position with skill, diligence, and good faith. The primary work arrangement is designated as: {{workLocation}}.

2. PROBATIONARY PERIOD
Employee's initial engagement shall be subject to a probationary review period of {{probationMonths}} months from the Start Date.

3. COMPENSATION & BENEFITS
In consideration of the services rendered, the Company shall pay Employee an annual base salary of {{annualSalary}}, payable in accordance with the standard payroll practices of the Company, subject to applicable statutory deductions and tax withholdings.

4. TERMINATION AND NOTICE
During or following the probationary period, either party may terminate this employment relationship with or without cause by providing {{noticePeriodWeeks}} weeks' written notice, or payment in lieu thereof as permitted by local labor regulations.

5. INTELLECTUAL PROPERTY & PROPRIETARY INFORMATION
Employee agrees that all inventions, discoveries, software code, designs, and improvements conceived or reduced to practice during the term of employment relating to the Company's business shall belong solely and exclusively to the Company.

6. GOVERNING LAW
This Agreement shall be governed and interpreted under the laws of {{governingLaw}}.

Employer: {{companyName}}
Representative Signature: _________________________

Employee: {{employeeName}}
Signature: _______________________________________
Date: ____________________________________________`
    }
  ];

  for (const t of templates) {
    const existing = await prisma.documentTemplate.findFirst({
      where: { title: t.title },
    });

    if (!existing) {
      await prisma.documentTemplate.create({
        data: t,
      });
      console.log(`📄 Template seeded: ${t.title}`);
    }
  }

  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
