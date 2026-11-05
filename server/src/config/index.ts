import dotenv from 'dotenv';
import { randomBytes } from 'node:crypto';
import path from 'path';
import fs from 'fs';

dotenv.config();

export const PORT = parseInt(process.env.PORT || '5000', 10);
export const JWT_SECRET = process.env.JWT_SECRET || randomBytes(32).toString('hex');
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || /legalbuddy|replace-with/i.test(process.env.JWT_SECRET))) {
  throw new Error('Production requires a random JWT_SECRET of at least 32 characters.');
}
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function integerSetting(name: string, fallback: number, min: number, max: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Invalid ${name}: expected an integer from ${min} to ${max}.`);
  return value;
}
export const RAG_CHUNK_SIZE = integerSetting('RAG_CHUNK_SIZE', 1500, 300, 3000);
export const RAG_CHUNK_OVERLAP = integerSetting('RAG_CHUNK_OVERLAP', 180, 0, Math.floor(RAG_CHUNK_SIZE / 2));
export const RAG_RETRIEVAL_LIMIT = integerSetting('RAG_RETRIEVAL_LIMIT', 5, 1, 10);

function booleanSetting(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined) return fallback;
  if (value !== 'true' && value !== 'false') throw new Error('Invalid ' + name + ': expected true or false.');
  return value === 'true';
}
export const RAG_SEARCH_MODE = process.env.RAG_SEARCH_MODE || 'hybrid';
if (!['hybrid', 'semantic', 'keyword'].includes(RAG_SEARCH_MODE)) throw new Error('Invalid RAG_SEARCH_MODE.');
export const RAG_CANDIDATE_LIMIT = integerSetting('RAG_CANDIDATE_LIMIT', 24, 10, 100);
export const RAG_RRF_K = integerSetting('RAG_RRF_K', 60, 1, 1000);
export const RAG_RERANK_ENABLED = booleanSetting('RAG_RERANK_ENABLED', false);
export const RAG_RERANK_TIMEOUT_MS = integerSetting('RAG_RERANK_TIMEOUT_MS', 40, 1, 5000);
export const RAG_SEARCH_TIMEOUT_MS = integerSetting('RAG_SEARCH_TIMEOUT_MS', 5000, 50, 30000);
export const RAG_MAX_CHUNKS = integerSetting('RAG_MAX_CHUNKS', 20000, 100, 100000);
export const RAG_LOG_METRICS = booleanSetting('RAG_LOG_METRICS', false);
export const RAG_EMBEDDING_MODEL_PATH = path.resolve(process.cwd(), process.env.RAG_EMBEDDING_MODEL_PATH || 'models/all-MiniLM-L6-v2');
export const RAG_EMBEDDING_ENABLED = booleanSetting('RAG_EMBEDDING_ENABLED', fs.existsSync(RAG_EMBEDDING_MODEL_PATH));
export const RAG_EMBEDDING_PYTHON = process.env.RAG_EMBEDDING_PYTHON || process.env.OCR_PYTHON || 'python';
export const RAG_EMBEDDING_STARTUP_MS = integerSetting('RAG_EMBEDDING_STARTUP_MS', 120000, 1000, 300000);
export const RAG_EMBEDDING_TIMEOUT_MS = integerSetting('RAG_EMBEDDING_TIMEOUT_MS', 30000, 50, 120000);

// AI Provider settings
export const AI_PROVIDER = process.env.AI_PROVIDER || 'auto';
export const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
export const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
export const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct';

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
export const OCR_DPI = parseInt(process.env.OCR_DPI || '150', 10);

/** Safety cap on the number of scanned pages OCR'd per document (oversized PDFs). */
export const OCR_MAX_PAGES = parseInt(process.env.OCR_MAX_PAGES || '300', 10);

/** Hard timeout (ms) for a single OCR worker invocation. */
export const OCR_TIMEOUT_MS = parseInt(process.env.OCR_TIMEOUT_MS || '900000', 10);


if (!fs.existsSync(GENERATED_DIR)) {
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
}

export const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// ---------------------------------------------------------------------------
// Legal Buddy Connect
// ---------------------------------------------------------------------------

/**
 * Private storage for lawyer credentials and profile photos. Deliberately OUTSIDE
 * UPLOAD_DIR so `npm run clean:uploads` never deletes verification evidence, and
 * never exposed through express.static.
 */
export const CONNECT_PRIVATE_DIR = path.resolve(process.cwd(), process.env.CONNECT_PRIVATE_DIR || './private_uploads/connect');
export const CONNECT_CREDENTIAL_MAX_MB = integerSetting('CONNECT_CREDENTIAL_MAX_MB', 5, 1, 20);
export const CONNECT_PHOTO_MAX_MB = integerSetting('CONNECT_PHOTO_MAX_MB', 2, 1, 10);
for (const sub of ['credentials', 'photos']) {
  fs.mkdirSync(path.join(CONNECT_PRIVATE_DIR, sub), { recursive: true });
}

/**
 * Geocoding goes through the backend only (never from the browser). The default is the
 * public OSM Nominatim instance, which is suitable for development/demo only:
 * https://operations.osmfoundation.org/policies/nominatim/ (max 1 request/second for the
 * whole application, identifying User-Agent, caching required, no autocomplete).
 * Point GEOCODER_URL at a self-hosted Nominatim or another compatible provider for production.
 */
export const GEOCODER_ENABLED = booleanSetting('GEOCODER_ENABLED', true);
export const GEOCODER_URL = (process.env.GEOCODER_URL || 'https://nominatim.openstreetmap.org').replace(/\/+$/, '');
export const GEOCODER_USER_AGENT = process.env.GEOCODER_USER_AGENT || '';
export const GEOCODER_COUNTRY_CODES = process.env.GEOCODER_COUNTRY_CODES || 'in';
export const GEOCODER_MIN_INTERVAL_MS = integerSetting('GEOCODER_MIN_INTERVAL_MS', 1100, 0, 60000);
export const GEOCODER_TIMEOUT_MS = integerSetting('GEOCODER_TIMEOUT_MS', 8000, 500, 30000);
