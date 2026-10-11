import process from 'node:process';
import fs from 'node:fs';
import path from 'node:path';
import prisma from '../src/prisma/client.js';

async function main() {
  console.log('🧹 Cleaning all uploaded previous data...');

  const deletedDocs = await prisma.document.deleteMany();
  console.log(`🗑️  Deleted ${deletedDocs.count} document record(s) from database.`);

  const deletedGen = await prisma.generatedDocument.deleteMany();
  console.log(`🗑️  Deleted ${deletedGen.count} generated document draft(s) from database.`);

  const uploadsDir = path.resolve(process.cwd(), './uploads');
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

  const genDir = path.resolve(process.cwd(), './generated_docs');
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

  console.log('✨ All previous uploaded data has been deleted successfully!');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Cleanup failed:', e);
  await prisma.$disconnect();
  process.exit(1);
});
