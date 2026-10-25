import { PdfService } from '../src/services/pdf-service.js';
import { LocalAnalysisService } from '../src/services/local-analysis.service.js';

async function inspect() {
  console.log('--- Inspecting NDA PDF ---');
  const ndaRes = await PdfService.extractText('./sample_contracts/sample_nda.pdf');
  console.log('NDA Page count:', ndaRes.pageCount);
  console.log('NDA Text sample:\n', ndaRes.text.slice(0, 300));

  const summary = await LocalAnalysisService.generateSummary(ndaRes.text, 'sample_nda.pdf');
  console.log('\nNDA Summary:', {
    contractType: summary.contractType,
    parties: summary.parties,
    effectiveDate: summary.effectiveDate,
    purpose: summary.purpose,
  });

  const clauses = await LocalAnalysisService.analyzeClauses(ndaRes.text);
  console.log('\nNDA Clauses count:', clauses.length);
  for (const c of clauses) {
    console.log(` - [${c.category}] ${c.title} (Page ${c.pageNumber}): "${c.excerpt.slice(0, 60)}..."`);
  }
}

inspect().catch(console.error);
