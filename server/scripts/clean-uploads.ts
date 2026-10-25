import 'dotenv/config';
import process from 'node:process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, '..');

async function main() {
  console.log('🧹 Cleaning all uploaded previous data...');

  if (process.env.DATABASE_URL) {
    try {
      const { default: prisma } = await import('../src/prisma/client.js');
      const deletedDocs = await prisma.document.deleteMany();
      console.log(`🗑️  Deleted ${deletedDocs.count} document record(s) from database.`);

      const deletedGen = await prisma.generatedDocument.deleteMany();
      console.log(`🗑️  Deleted ${deletedGen.count} generated document draft(s) from database.`);
      await prisma.$disconnect();
    } catch (dbErr: any) {
      console.warn(`⚠️  Skipped database cleanup (${dbErr.message || dbErr}). Proceeding with filesystem cleanup.`);
    }
  } else {
    console.log('ℹ️  DATABASE_URL not set; skipping database table cleanup.');
  }

  const uploadsDir = path.resolve(serverRoot, 'uploads');
  if (fs.existsSync(uploadsDir)) {
    const items = fs.readdirSync(uploadsDir);
    let fileCount = 0;
    for (const item of items) {
      const fullPath = path.join(uploadsDir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        fs.rmSync(fullPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(fullPath);
        fileCount++;
      }
    }
    console.log(`📁 Deleted ${fileCount} uploaded file(s) and cache folders from ${uploadsDir}.`);
  }

  fs.mkdirSync(path.join(uploadsDir, 'ocr_cache'), { recursive: true });
  fs.mkdirSync(path.join(uploadsDir, 'ocr_render'), { recursive: true });

  const genDir = path.resolve(serverRoot, 'generated_docs');
  if (fs.existsSync(genDir)) {
    const files = fs.readdirSync(genDir);
    for (const f of files) {
      const fullPath = path.join(genDir, f);
      if (!fs.statSync(fullPath).isDirectory()) {
        fs.unlinkSync(fullPath);
      }
    }
    console.log(`📄 Cleared generated docs directory.`);
  }

  // Also clean root uploads if any exist
  const rootUploads = path.resolve(serverRoot, '..', 'uploads');
  if (fs.existsSync(rootUploads)) {
    fs.rmSync(rootUploads, { recursive: true, force: true });
  }

  console.log('✨ All uploaded files and cache have been deleted successfully!');
}

main().catch(async (e) => {
  console.error('Cleanup failed:', e);
  process.exit(1);
});
