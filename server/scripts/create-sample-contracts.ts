import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

const samplesDir = path.resolve(process.cwd(), './sample_contracts');
if (!fs.existsSync(samplesDir)) {
  fs.mkdirSync(samplesDir, { recursive: true });
}

async function createSampleContracts() {
  console.log('📄 Creating sample test contracts...');

  // 1. Sample NDA (2 Pages)
  const ndaDoc = await PDFDocument.create();
  const font = await ndaDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await ndaDoc.embedFont(StandardFonts.HelveticaBold);

  // Page 1
  let page1 = ndaDoc.addPage([600, 800]);
  page1.drawText('MUTUAL NON-DISCLOSURE AGREEMENT', { x: 50, y: 740, size: 16, font: boldFont, color: rgb(0.1, 0.1, 0.3) });
  page1.drawText('This Mutual Non-Disclosure Agreement is entered into on October 15, 2026 ("Effective Date")', { x: 50, y: 710, size: 10, font });
  page1.drawText('by and between Acme Innovations Inc. ("Disclosing Party") and Zenith Global Ltd. ("Receiving Party").', { x: 50, y: 690, size: 10, font });
  
  page1.drawText('1. PURPOSE OF DISCLOSURE', { x: 50, y: 650, size: 12, font: boldFont });
  page1.drawText('The Parties wish to explore and evaluate a prospective strategic commercial engagement involving enterprise AI analytics.', { x: 50, y: 630, size: 10, font });

  page1.drawText('2. CONFIDENTIAL INFORMATION DEFINITION', { x: 50, y: 590, size: 12, font: boldFont });
  page1.drawText('"Confidential Information" shall include all proprietary trade secrets, technical designs, financial projections,', { x: 50, y: 570, size: 10, font });
  page1.drawText('and customer databases disclosed directly or indirectly by Disclosing Party to Receiving Party.', { x: 50, y: 555, size: 10, font });

  page1.drawText('3. DUTY OF CONFIDENTIALITY', { x: 50, y: 515, size: 12, font: boldFont });
  page1.drawText('Receiving Party agrees to protect confidential information using the same degree of care it uses for its own information,', { x: 50, y: 495, size: 10, font });
  page1.drawText('but in no event less than reasonable care. Disclosure is restricted strictly to employees on a need-to-know basis.', { x: 50, y: 480, size: 10, font });

  page1.drawText('Page 1 of 2', { x: 270, y: 40, size: 9, font, color: rgb(0.5, 0.5, 0.5) });

  // Page 2
  let page2 = ndaDoc.addPage([600, 800]);
  page2.drawText('4. TERM AND TERMINATION', { x: 50, y: 740, size: 12, font: boldFont });
  page2.drawText('This Agreement and all non-disclosure obligations shall remain in full force for a period of 3 years from the Effective Date.', { x: 50, y: 720, size: 10, font });
  page2.drawText('Either Party may terminate discussions upon 30 days prior written notice. Upon request, Receiving Party shall return', { x: 50, y: 705, size: 10, font });
  page2.drawText('all confidential materials within 15 days of notice.', { x: 50, y: 690, size: 10, font });

  page2.drawText('5. LIMITATION OF LIABILITY & REMEDIES', { x: 50, y: 650, size: 12, font: boldFont });
  page2.drawText('The Parties acknowledge monetary damages may be inadequate for breach, entitling the Disclosing Party to injunctive relief.', { x: 50, y: 630, size: 10, font });
  page2.drawText('Each Party total aggregate liability for incidental damages under this agreement shall be capped at $50,000 USD.', { x: 50, y: 615, size: 10, font });

  page2.drawText('6. GOVERNING LAW & JURISDICTION', { x: 50, y: 575, size: 12, font: boldFont });
  page2.drawText('This Agreement shall be governed and interpreted in accordance with the substantive laws of the State of Delaware.', { x: 50, y: 555, size: 10, font });
  page2.drawText('The competent courts in Delaware shall have exclusive jurisdiction over any disputes arising hereunder.', { x: 50, y: 540, size: 10, font });

  page2.drawText('IN WITNESS WHEREOF, the Parties have executed this Agreement as of the Effective Date.', { x: 50, y: 480, size: 10, font });
  page2.drawText('Page 2 of 2', { x: 270, y: 40, size: 9, font, color: rgb(0.5, 0.5, 0.5) });

  const ndaBytes = await ndaDoc.save({ useObjectStreams: false });
  const ndaPath = path.join(samplesDir, 'sample_nda.pdf');
  fs.writeFileSync(ndaPath, ndaBytes);
  console.log(`✅ Created: ${ndaPath}`);

  // 2. Sample MSA (2 Pages)
  const msaDoc = await PDFDocument.create();
  let msaP1 = msaDoc.addPage([600, 800]);
  msaP1.drawText('MASTER SERVICES AGREEMENT', { x: 50, y: 740, size: 16, font: boldFont, color: rgb(0.1, 0.1, 0.3) });
  msaP1.drawText('This Master Services Agreement is entered into on November 1, 2026 by and between Nexus Enterprises Corp. ("Client")', { x: 50, y: 710, size: 10, font });
  msaP1.drawText('and Apex Software Solutions LLC ("Service Provider").', { x: 50, y: 690, size: 10, font });

  msaP1.drawText('1. SCOPE OF SERVICES', { x: 50, y: 650, size: 12, font: boldFont });
  msaP1.drawText('Service Provider agrees to provide cloud application architecture, microservice development, and system security consulting.', { x: 50, y: 630, size: 10, font });

  msaP1.drawText('2. FEES AND PAYMENT TERMS', { x: 50, y: 590, size: 12, font: boldFont });
  msaP1.drawText('Client shall pay Service Provider a monthly consideration fee of $15,000 USD. Invoices shall be submitted monthly and paid', { x: 50, y: 570, size: 10, font });
  msaP1.drawText('within 30 days of receipt ("Net 30"). Late payments accrue interest at 1.5% per month.', { x: 50, y: 555, size: 10, font });

  msaP1.drawText('3. INTELLECTUAL PROPERTY RIGHTS', { x: 50, y: 515, size: 12, font: boldFont });
  msaP1.drawText('All deliverables created specifically for Client shall be work made for hire. Upon full payment of fees, Client owns all right,', { x: 50, y: 495, size: 10, font });
  msaP1.drawText('title, and interest. Service Provider retains background tools and pre-existing software libraries.', { x: 50, y: 480, size: 10, font });

  msaP1.drawText('4. LIMITATION OF LIABILITY', { x: 50, y: 440, size: 12, font: boldFont });
  msaP1.drawText('Total aggregate liability of either party shall be capped at the total fees paid in the prior 12 months under this agreement.', { x: 50, y: 420, size: 10, font });
  msaP1.drawText('Neither party shall be liable for indirect or consequential damages.', { x: 50, y: 405, size: 10, font });

  msaP1.drawText('5. TERMINATION FOR CONVENIENCE', { x: 50, y: 365, size: 12, font: boldFont });
  msaP1.drawText('Either Party may terminate this Agreement by providing at least 30 days prior written notice to the other Party.', { x: 50, y: 345, size: 10, font });

  msaP1.drawText('6. GOVERNING LAW', { x: 50, y: 305, size: 12, font: boldFont });
  msaP1.drawText('This Agreement shall be governed by and construed under the laws of the State of New York.', { x: 50, y: 285, size: 10, font });

  const msaBytes = await msaDoc.save({ useObjectStreams: false });
  const msaPath = path.join(samplesDir, 'sample_msa.pdf');
  fs.writeFileSync(msaPath, msaBytes);
  console.log(`✅ Created: ${msaPath}`);

  // 3. Sample Empty / Scanned PDF (0 text)
  const emptyDoc = await PDFDocument.create();
  const fontEmpty = await emptyDoc.embedFont(StandardFonts.Helvetica);
  let emptyP = emptyDoc.addPage([600, 800]);
  emptyP.drawText('   ', { x: 50, y: 50, size: 10, font: fontEmpty });
  const emptyBytes = await emptyDoc.save({ useObjectStreams: false });
  const emptyPath = path.join(samplesDir, 'sample_empty_scanned.pdf');
  fs.writeFileSync(emptyPath, emptyBytes);
  console.log(`✅ Created: ${emptyPath}`);

  // 4. Sample Invalid Non-PDF file
  const invalidPath = path.join(samplesDir, 'invalid_format.txt');
  fs.writeFileSync(invalidPath, 'This is a plain text file, not a valid PDF document.');
  console.log(`✅ Created: ${invalidPath}`);

  console.log('🎉 All test contracts created successfully!');
}

createSampleContracts().catch(console.error);
