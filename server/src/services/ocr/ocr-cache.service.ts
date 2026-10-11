import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { UPLOAD_DIR, OCR_LANG, OCR_DPI } from '../../config/index.js';

export interface CachedPageResult {
  pageNumber: number;
  text: string;
  confidence: number;
  wordCount: number;
  lineCount?: number;
  renderMs?: number;
  ocrMs?: number;
  error?: string;
}

export interface CachedOcrData {
  engine: string;
  model: string;
  paddleVersion?: string;
  dpi: number;
  docHash: string;
  cachedAt: string;
  pages: CachedPageResult[];
}

export class OcrCacheService {
  private static cacheDir = path.join(UPLOAD_DIR, 'ocr_cache');

  private static ensureCacheDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Computes a reliable SHA-256 hash of the document content.
   */
  static computeDocHash(filePath: string): string {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Cannot compute hash. File does not exist: ${filePath}`);
    }
    const buffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Generates a unique cache key based on the document hash and OCR processing configuration.
   * If any configuration parameter changes (DPI, model, language), the key changes,
   * cleanly invalidating obsolete caches.
   */
  static getCacheKey(
    docHash: string,
    lang: string = OCR_LANG,
    dpi: number = OCR_DPI,
    paddleVersion: string = 'PP-OCRv5'
  ): string {
    const configSignature = `${docHash}:${lang}:${dpi}:${paddleVersion}`;
    return crypto.createHash('md5').update(configSignature).digest('hex');
  }

  /**
   * Retrieves cached OCR data if it exists and is valid.
   */
  static get(cacheKey: string): CachedOcrData | null {
    this.ensureCacheDir();
    const filePath = path.join(this.cacheDir, `${cacheKey}.json`);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content) as CachedOcrData;
      if (parsed && Array.isArray(parsed.pages)) {
        return parsed;
      }
    } catch (err: any) {
      console.warn(`[OcrCacheService] Failed to read corrupted cache ${filePath}:`, err?.message);
      try {
        fs.unlinkSync(filePath);
      } catch (_) {}
    }
    return null;
  }

  /**
   * Writes OCR results to cache for future requests.
   */
  static set(cacheKey: string, data: CachedOcrData): void {
    this.ensureCacheDir();
    const filePath = path.join(this.cacheDir, `${cacheKey}.json`);
    try {
      fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8');
    } catch (err: any) {
      console.warn(`[OcrCacheService] Failed to write cache ${filePath}:`, err?.message);
    }
  }

  /**
   * Invalidates cache by cache key.
   */
  static invalidate(cacheKey: string): void {
    this.ensureCacheDir();
    const filePath = path.join(this.cacheDir, `${cacheKey}.json`);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (_) {}
    }
  }

  /**
   * Invalidates any cache for a specific document file path.
   */
  static invalidateDoc(filePath: string): void {
    try {
      const docHash = this.computeDocHash(filePath);
      const key = this.getCacheKey(docHash);
      this.invalidate(key);
    } catch (_) {}
  }
}
