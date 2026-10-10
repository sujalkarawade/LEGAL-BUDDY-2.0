import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

export const PORT = parseInt(process.env.PORT || '5000', 10);
export const JWT_SECRET = process.env.JWT_SECRET || 'legalbuddy_super_secure_jwt_secret_dev_key_2026_xyz';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export const AI_PROVIDER = process.env.AI_PROVIDER || 'auto';
export const GROQ_API_KEY = process.env.LLM_API_KEY || process.env.GROQ_API_KEY || '';
export const LLM_MODEL = process.env.LLM_MODEL || 'meta-llama/llama-3.3-70b-instruct';
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

export const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '15', 10);
export const UPLOAD_DIR = path.resolve(process.cwd(), process.env.UPLOAD_DIR || './uploads');
export const GENERATED_DIR = path.resolve(process.cwd(), './generated_docs');

// Ensure necessary directories exist
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ---------------------------------------------------------------------------
// Local OCR (PaddleOCR) configuration
//
// PaddleOCR replaces the former Azure AI Document Intelligence dependency.
// The engine runs fully locally and requires NO credentials. The Devanagari
// recognition model supports both Marathi and English.
// ---------------------------------------------------------------------------

/** Python executable used to launch the local PaddleOCR worker. */
export const OCR_PYTHON = process.env.OCR_PYTHON || 'python';

/**
 * PaddleOCR language / model preset. The PP-OCRv5 Devanagari recognition model
 * supports Marathi AND English, so a single preset handles mixed documents.
 * Other options: 'en', 'devanagari', 'latin', 'korean', 'ch'.
 */
export const OCR_LANG = process.env.OCR_LANG || 'devanagari';

/** Render resolution (DPI) for scanned pages before OCR. Higher = more accurate but slower. */
export const OCR_DPI = parseInt(process.env.OCR_DPI || '200', 10);

/** Safety cap on the number of scanned pages OCR'd per document (oversized PDFs). */
export const OCR_MAX_PAGES = parseInt(process.env.OCR_MAX_PAGES || '300', 10);

/** Hard timeout (ms) for a single OCR worker invocation. */
export const OCR_TIMEOUT_MS = parseInt(process.env.OCR_TIMEOUT_MS || '900000', 10);


if (!fs.existsSync(GENERATED_DIR)) {
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
}

export const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
