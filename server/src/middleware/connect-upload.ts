import multer from 'multer';
import path from 'node:path';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { CONNECT_CREDENTIAL_MAX_MB, CONNECT_PHOTO_MAX_MB } from '../config/index.js';

/**
 * Uploads for Legal Buddy Connect are kept in memory (small size caps), validated by
 * extension, declared MIME type AND file signature, and only then written to private
 * storage by connect-file.service.ts with a random name. Nothing is ever served statically.
 */
export const FILE_SIGNATURES: Record<string, { ext: string[]; magic: number[] }> = {
  'application/pdf': { ext: ['.pdf'], magic: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // %PDF-
  'image/jpeg': { ext: ['.jpg', '.jpeg'], magic: [0xff, 0xd8, 0xff] },
  'image/png': { ext: ['.png'], magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
};

export function hasValidSignature(buffer: Buffer, mimeType: string): boolean {
  const signature = FILE_SIGNATURES[mimeType];
  if (!signature || buffer.length < signature.magic.length) return false;
  return signature.magic.every((byte, index) => buffer[index] === byte);
}

function buildUpload(allowed: string[], maxMb: number) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxMb * 1024 * 1024, files: 1, fields: 10 },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const rule = FILE_SIGNATURES[file.mimetype];
      if (allowed.includes(file.mimetype) && rule && rule.ext.includes(ext)) cb(null, true);
      else cb(new UploadRejected());
    },
  });
}

class UploadRejected extends Error {}

/** Wraps multer so Connect uploads return accurate messages instead of the PDF-only global handler text. */
function guarded(upload: multer.Multer, field: string, allowed: string[], maxMb: number): RequestHandler {
  const single = upload.single(field);
  const typeList = allowed.map(t => FILE_SIGNATURES[t].ext[0].slice(1).toUpperCase()).join(', ');
  return (req: Request, res: Response, next: NextFunction) => {
    single(req, res, (error: unknown) => {
      if (!error) {
        if (!req.file) { res.status(400).json({ error: 'Please choose a file to upload.' }); return; }
        if (!hasValidSignature(req.file.buffer, req.file.mimetype)) {
          res.status(400).json({ error: `The file content does not match its type. Allowed: ${typeList}.` });
          return;
        }
        next();
        return;
      }
      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ error: `File is too large. Maximum size is ${maxMb} MB.` });
        return;
      }
      res.status(400).json({ error: `Unsupported file. Allowed types: ${typeList}.` });
    });
  };
}

const CREDENTIAL_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const PHOTO_TYPES = ['image/jpeg', 'image/png'];

export const credentialUpload = guarded(buildUpload(CREDENTIAL_TYPES, CONNECT_CREDENTIAL_MAX_MB), 'file', CREDENTIAL_TYPES, CONNECT_CREDENTIAL_MAX_MB);
export const photoUpload = guarded(buildUpload(PHOTO_TYPES, CONNECT_PHOTO_MAX_MB), 'file', PHOTO_TYPES, CONNECT_PHOTO_MAX_MB);
