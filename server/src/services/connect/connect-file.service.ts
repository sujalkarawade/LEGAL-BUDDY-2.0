import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import type { Response } from 'express';
import { CONNECT_PRIVATE_DIR } from '../../config/index.js';
import { FILE_SIGNATURES } from '../../middleware/connect-upload.js';

type Area = 'credentials' | 'photos';

const STORED_NAME = /^[a-f0-9]{32}\.(pdf|jpg|png)$/;

/** Writes a validated upload into private storage with a random name. Never uses the client's filename on disk. */
export async function storePrivateFile(area: Area, file: Express.Multer.File) {
  const ext = FILE_SIGNATURES[file.mimetype]?.ext[0]; // '.pdf' | '.jpg' | '.png'
  if (!ext) throw new Error('Unsupported file type.');
  const storedName = `${randomBytes(16).toString('hex')}${ext}`;
  await fs.promises.writeFile(path.join(CONNECT_PRIVATE_DIR, area, storedName), file.buffer, { flag: 'wx', mode: 0o600 });
  return {
    storedName,
    sha256: createHash('sha256').update(file.buffer).digest('hex'),
    sizeBytes: file.size,
    mimeType: file.mimetype,
    originalName: sanitizeOriginalName(file.originalname),
  };
}

export function sanitizeOriginalName(name: string): string {
  const base = path.basename(name).replace(/[^\w.\- ()]/g, '_').slice(0, 150);
  return base || 'upload';
}

export async function deletePrivateFile(area: Area, storedName: string | null | undefined): Promise<void> {
  if (!storedName || !STORED_NAME.test(storedName)) return;
  await fs.promises.unlink(path.join(CONNECT_PRIVATE_DIR, area, storedName)).catch(() => undefined);
}

/**
 * Streams a private file to an already-authorised requester. storedName is re-validated so a
 * tampered database value can never escape the private directory.
 */
export function sendPrivateFile(res: Response, area: Area, storedName: string, mimeType: string, downloadName?: string): void {
  if (!STORED_NAME.test(storedName)) { res.status(404).json({ error: 'File not found.' }); return; }
  const filePath = path.join(CONNECT_PRIVATE_DIR, area, storedName);
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'File not found.' }); return; }
  res.setHeader('Content-Type', mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', area === 'photos' ? 'private, max-age=300' : 'no-store');
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
  if (downloadName) res.setHeader('Content-Disposition', `inline; filename="${sanitizeOriginalName(downloadName).replace(/"/g, '')}"`);
  fs.createReadStream(filePath).pipe(res);
}
