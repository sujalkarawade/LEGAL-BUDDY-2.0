import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('🚀 Starting Legal Buddy E2E Automated Verification Test Suite...\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail: string = '') {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✅ [PASS] ${testName}`);
    } else {
      console.error(`  ❌ [FAIL] ${testName} - ${detail}`);
    }
  }

  // TEST 1: User Login & JWT Generation
  console.log('--- Phase 1: Authentication & User Roles ---');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@legalbuddy.io', password: 'Password123!' }),
  });
  const loginData: any = await loginRes.json();
  assert(loginRes.status === 200 && !!loginData.token, 'Test User Login (Adv. Sarah Jenkins)');
  const sarahToken = loginData.token;

  // Invalid credentials test
  const invalidLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@legalbuddy.io', password: 'WrongPassword!' }),
  });
  assert(invalidLoginRes.status === 401, 'Reject Invalid Credentials with 401');

  // Verify /api/auth/me
  const meRes = await fetch(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${sarahToken}` },
  });
  const meData: any = await meRes.json();
  assert(meRes.status === 200 && meData.user.email === 'test@legalbuddy.io', 'Fetch Authenticated User Profile');

  // TEST 2: PDF Upload and Edge Cases
  console.log('\n--- Phase 2: PDF Upload, Text Extraction & Edge Case Handling ---');
  const samplesDir = path.resolve(process.cwd(), './sample_contracts');

  // Edge Case: Invalid non-PDF file
  const invalidForm = new FormData();
  const invalidBuffer = fs.readFileSync(path.join(samplesDir, 'invalid_format.txt'));
  invalidForm.append('file', new File([invalidBuffer], 'invalid_format.txt', { type: 'text/plain' }));
  const invalidUploadRes = await fetch(`${BASE_URL}/documents/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${sarahToken}` },
    body: invalidForm,
  });
  assert(invalidUploadRes.status === 400 || invalidUploadRes.status === 500, 'Reject Non-PDF Uploads with Validation Error');

  // Edge Case: Scanned / Empty PDF
  const scannedForm = new FormData();
  const scannedBuffer = fs.readFileSync(path.join(samplesDir, 'sample_empty_scanned.pdf'));
  scannedForm.append('file', new File([scannedBuffer], 'sample_empty_scanned.pdf', { type: 'application/pdf' }));
  const scannedUploadRes = await fetch(`${BASE_URL}/documents/upload?sync=true`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${sarahToken}` },
    body: scannedForm,
  });
  const scannedData: any = await scannedUploadRes.json();
  if (scannedUploadRes.status !== 201) {
    console.log('   [DEBUG] Scanned Upload status:', scannedUploadRes.status, 'data:', scannedData);
  }
  assert(
    scannedUploadRes.status === 201 && (scannedData.document?.warning || scannedData.document?.errorMessage || scannedData.message || '').toLowerCase().includes('scanned'),
    'Detect Scanned / Empty PDF and Provide OCR Warning',
    JSON.stringify(scannedData)
  );

  // Valid PDF Upload: 2-Page Mutual NDA
  const ndaForm = new FormData();
  const ndaBuffer = fs.readFileSync(path.join(samplesDir, 'sample_nda.pdf'));
  ndaForm.append('file', new File([ndaBuffer], 'sample_nda.pdf', { type: 'application/pdf' }));
  const ndaUploadRes = await fetch(`${BASE_URL}/documents/upload?sync=true`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${sarahToken}` },
    body: ndaForm,
  });
  const ndaData: any = await ndaUploadRes.json();
  assert(
    ndaUploadRes.status === 201 && ndaData.document.status === 'COMPLETED' && ndaData.document.pageCount === 2,
    'Upload & Parse 2-Page Mutual NDA (Page tracking preserved)'
  );
  const ndaDocId = ndaData.document.id;

  // TEST 3: Contract Summary Verification
  console.log('\n--- Phase 3: Contract Summary Ground-Truth Verification ---');
  const summaryRes = await fetch(`${BASE_URL}/documents/${ndaDocId}/summary`, {
    headers: { Authorization: `Bearer ${sarahToken}` },
  });
  const summaryData: any = await summaryRes.json();
  const s = summaryData.summary;
  assert(
    summaryRes.status === 200 &&
    s.contractType.includes('Non-Disclosure Agreement') &&
    s.parties.includes('Acme Innovations Inc.') &&
    s.effectiveDate.includes('October 15, 2026'),
    'Summary Extracts Real Factual Details (Parties, Dates, Purpose)'
  );

  // TEST 4: Clause Risk Analysis
  console.log('\n--- Phase 4: Clause Analysis & Risk Identification ---');
  const clauseRes = await fetch(`${BASE_URL}/documents/${ndaDocId}/clauses`, {
    headers: { Authorization: `Bearer ${sarahToken}` },
  });
  const clauseData: any = await clauseRes.json();
  const clauses = clauseData.clauses;
  assert(clauses.length >= 3, `Identify Multiple Contract Clauses (Found ${clauses.length})`);
  
  const confClause = clauses.find((c: any) => c.category === 'Confidentiality');
  assert(
    !!confClause && (confClause.excerpt.toLowerCase().includes('confidential') || confClause.excerpt.toLowerCase().includes('protect')),
    'Clause Excerpts Correlate with Actual Document Text'
  );

  // Update clause status
  const updateClauseRes = await fetch(`${BASE_URL}/documents/${ndaDocId}/clauses/${clauses[0].id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${sarahToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reviewStatus: 'APPROVED' }),
  });
  const updatedClauseData: any = await updateClauseRes.json();
  assert(updatedClauseData.clause.reviewStatus === 'APPROVED', 'Counsel Can Update Clause Review Status to APPROVED');

  // TEST 5: Completeness Checker
  console.log('\n--- Phase 5: Contract Completeness Checker ---');
  const compRes = await fetch(`${BASE_URL}/documents/${ndaDocId}/completeness`, {
    headers: { Authorization: `Bearer ${sarahToken}` },
  });
  const compData: any = await compRes.json();
  const compItems = compData.checks;
  assert(compItems.length > 5, `Completeness Checklist Evaluated (Items: ${compItems.length})`);
  
  const foundItems = compItems.filter((i: any) => i.status === 'FOUND');
  assert(foundItems.length >= 2, 'Detect Present Standard Sections with Evidence Excerpts');

  // Toggle review
  const toggleRes = await fetch(`${BASE_URL}/documents/${ndaDocId}/completeness/${compItems[0].id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${sarahToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ isReviewed: true }),
  });
  const toggleData: any = await toggleRes.json();
  assert(toggleData.check.isReviewed === true, 'Reviewer Can Mark Completeness Item as Reviewed');

  // TEST 6: Dates & Obligations Extractor
  console.log('\n--- Phase 6: Key Dates & Obligations Extractor ---');
  const obRes = await fetch(`${BASE_URL}/documents/${ndaDocId}/obligations`, {
    headers: { Authorization: `Bearer ${sarahToken}` },
  });
  const obData: any = await obRes.json();
  const obligations = obData.obligations;
  assert(obligations.length > 0, `Extract Contractual Deadlines & Performance Covenants (Found: ${obligations.length})`);

  // TEST 7: Document-Grounded Chatbot
  console.log('\n--- Phase 7: Document-Grounded Chatbot (RAG) & Safeguards ---');
  // Question with answer present
  const chatQ1Res = await fetch(`${BASE_URL}/documents/${ndaDocId}/chat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sarahToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ question: 'What is the notice period for return of materials?' }),
  });
  const chatQ1Data: any = await chatQ1Res.json();
  assert(
    chatQ1Res.status === 200 && chatQ1Data.citations.length > 0 && chatQ1Data.message.content.includes('Page 2'),
    'Chat Answers Document Query with Source Page & Citation Excerpt'
  );

  // Question NOT present in document (Safeguard check)
  const chatQ2Res = await fetch(`${BASE_URL}/documents/${ndaDocId}/chat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sarahToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ question: 'What are the penalties for late shipment delivery?' }),
  });
  const chatQ2Data: any = await chatQ2Res.json();
  assert(
    chatQ2Data.message.content.toLowerCase().includes('not found') || chatQ2Data.message.content.toLowerCase().includes('does not contain'),
    'Chat Accurately Rejects Out-of-Document Questions with "Not Found" Safeguard'
  );

  // TEST 8: Multi-User Security & Authorization Isolation
  console.log('\n--- Phase 8: Multi-User Data Isolation & Ownership Security ---');
  // Login secondary user Alex
  const alexLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'alex@techcorp.io', password: 'Password123!' }),
  });
  const alexLoginData: any = await alexLoginRes.json();
  const alexToken = alexLoginData.token;

  // Alex tries to read Sarah's contract summary
  const unauthorizedRes = await fetch(`${BASE_URL}/documents/${ndaDocId}/summary`, {
    headers: { Authorization: `Bearer ${alexToken}` },
  });
  assert(unauthorizedRes.status === 403, 'Enforce User Isolation (User B cannot access User A contract - 403 Forbidden)');

  // TEST 9: Legal Document Generator
  console.log('\n--- Phase 9: Legal Document Generator & DOCX Output ---');
  const tplRes = await fetch(`${BASE_URL}/templates`, {
    headers: { Authorization: `Bearer ${sarahToken}` },
  });
  const tplData: any = await tplRes.json();
  assert(tplData.templates.length >= 3, 'Fetch Standard Document Templates Gallery');
  const ndaTemplate = tplData.templates.find((t: any) => t.title.includes('NDA'));

  // Test missing required field validation
  const invalidGenRes = await fetch(`${BASE_URL}/document-generator/generate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sarahToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      templateId: ndaTemplate.id,
      formData: { disclosingParty: 'Acme Corp' }, // missing receivingParty, effectiveDate, etc.
    }),
  });
  assert(invalidGenRes.status === 400, 'Validate Required Fields in Document Generator Wizard (400)');

  // Generate valid NDA draft
  const validGenRes = await fetch(`${BASE_URL}/document-generator/generate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sarahToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      templateId: ndaTemplate.id,
      customTitle: 'Commercial NDA - Test Draft',
      formData: {
        disclosingParty: 'Apex Innovations Corp',
        receivingParty: 'Vertex Labs Inc',
        effectiveDate: '2026-10-15',
        termYears: '3',
        governingLaw: 'State of Delaware',
        purpose: 'Strategic AI Partnership Evaluation',
        noticePeriodDays: '15',
      },
    }),
  });
  const validGenData: any = await validGenRes.json();
  assert(
    validGenRes.status === 201 && !!validGenData.generatedDocument.renderedContent,
    'Generate Structured Legal Draft from Template & Field Values'
  );
  const genDocId = validGenData.generatedDocument.id;

  // Download DOCX file
  const docxRes = await fetch(`${BASE_URL}/document-generator/${genDocId}/download`, {
    headers: { Authorization: `Bearer ${sarahToken}` },
  });
  const docxBlob = await docxRes.blob();
  assert(
    docxRes.status === 200 && docxBlob.size > 2000,
    `Download Valid Microsoft Word DOCX Document (${docxBlob.size} bytes)`
  );

  // TEST 10: Dashboard Aggregated Statistics
  console.log('\n--- Phase 10: Dashboard Metrics Persistence ---');
  const dashRes = await fetch(`${BASE_URL}/dashboard/stats`, {
    headers: { Authorization: `Bearer ${sarahToken}` },
  });
  const dashData: any = await dashRes.json();
  assert(
    dashRes.status === 200 && dashData.stats.totalDocs >= 1 && dashData.stats.totalClauses >= 1,
    'Dashboard Metrics Reflect Real Persisted Database Records'
  );

  console.log(`\n=======================================================`);
  console.log(`🎉 TEST SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED!`);
  console.log(`=======================================================\n`);
}

runTests().catch((e) => {
  console.error('Fatal error in test suite:', e);
  process.exit(1);
});
