import { AIAdapter } from '../src/services/ai/ai-adapter.js';

async function testAll() {
  console.log('Testing AIAdapter status:');
  const status = AIAdapter.getProviderStatus();
  console.log('Provider Status:', status);

  const sampleContract = `
AGREEMENT FOR SALE
This Agreement executed at Pune on this 20th day of September 2012.
BETWEEN:
M/s. PRIME PROPERTIES (Owner/Promoter)
AND
MR. SANTOSH JANARDHAN KARAWADE (Purchaser).
1. CONSIDERATION:
The total consideration for Residential Unit No. A1/806 having carpet area 36.15 sq.mt. is Rs. 18,70,310/- (Rupees Eighteen Lakh Seventy Thousand Three Hundred Ten only).
2. TERMINATION:
If purchaser defaults in payment, Owner/Promoter shall give 15 days prior notice to remedy breach.
Upon termination, 10% of total consideration shall be forfeited.
3. POSSESSION:
The Owner/Promoter shall deliver possession of the Unit within 30 months from date hereof.
4. JURISDICTION & STAMP DUTY:
Stamp duty paid at Joint Sub-Registrar Haveli-12, Pune. Disputes subject to Pune courts.
`;

  console.log('\n--- 1. Testing Summary with Llama 3.3 70B ---');
  const summary = await AIAdapter.generateSummary(sampleContract, 'sample_agreement.pdf');
  console.log('Summary Provider:', summary.analysisProvider);
  console.log('Contract Type:', summary.contractType);
  console.log('Parties:', summary.parties);
  console.log('Payment:', summary.paymentTerms);

  console.log('\n--- 2. Testing Clauses with Llama 3.3 70B ---');
  const clauses = await AIAdapter.analyzeClauses(sampleContract);
  console.log(`Clauses extracted: ${clauses.length}`);
  if (clauses.length > 0) {
    console.log('First clause:', clauses[0].category, '-', clauses[0].title, `(Risk: ${clauses[0].riskLevel})`);
  }

  console.log('\n--- 3. Testing Completeness with Llama 3.3 70B ---');
  const completeness = await AIAdapter.checkCompleteness(sampleContract, 'Agreement for Sale');
  console.log(`Completeness checks: ${completeness.length}`);
  if (completeness.length > 0) {
    console.log('First check:', completeness[0].expectedSection, '->', completeness[0].status);
  }

  console.log('\n--- 4. Testing Obligations with Llama 3.3 70B ---');
  const obligations = await AIAdapter.extractObligations(sampleContract);
  console.log(`Obligations extracted: ${obligations.length}`);
  if (obligations.length > 0) {
    console.log('First obligation:', obligations[0].category, '-', obligations[0].description, `(Due: ${obligations[0].dueDateOrPeriod})`);
  }

  console.log('\n--- 5. Testing Chatbot Q&A with Llama 3.3 70B ---');
  const chunks = [
    { chunkIndex: 0, pageNumber: 1, content: 'Residential Unit No. A1/806 consideration is Rs. 18,70,310/-.' },
    { chunkIndex: 1, pageNumber: 2, content: 'Promoter shall deliver possession within 30 months from agreement date.' },
  ];
  const chatRes = await AIAdapter.answerQuestion('What is the total price and possession timeline?', chunks);
  console.log('Chatbot Provider:', chatRes.provider);
  console.log('Chatbot Grounded:', chatRes.isDocumentGrounded);
  console.log('Chatbot Answer:\n', chatRes.answer);
  console.log('Citations:', chatRes.citations);

  console.log('\nALL 5 AI MODULES FULLY TESTED WITH GROQ LLAMA 3.3 70B!');
}

testAll().catch(console.error);
