import fs from 'fs';
import path from 'path';

async function uploadMsa() {
  const samplesDir = path.resolve(process.cwd(), './sample_contracts');
  const msaBuffer = fs.readFileSync(path.join(samplesDir, 'sample_msa.pdf'));
  const msaForm = new FormData();
  msaForm.append('file', new File([msaBuffer], 'sample_msa.pdf', { type: 'application/pdf' }));

  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@legalbuddy.io', password: 'Password123!' }),
  });
  const { token } = await loginRes.json();

  const uploadRes = await fetch('http://localhost:5000/api/documents/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: msaForm,
  });

  const uploadData = await uploadRes.json();
  console.log('✅ Uploaded MSA Contract successfully. Doc ID:', uploadData.document?.id);
}

uploadMsa().catch(console.error);
