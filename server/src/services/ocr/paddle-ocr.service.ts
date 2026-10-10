import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import {
  OCR_PYTHON,
  OCR_LANG,
  OCR_DPI,
  OCR_MAX_PAGES,
  OCR_TIMEOUT_MS,
  UPLOAD_DIR,
} from '../../config/index.js';

export interface PaddlePageResult {
  pageNumber: number;
  text: string;
  confidence: number;
  wordCount: number;
  lineCount: number;
  error?: string;
}

export interface PaddleScannedResult {
  pages: Map<number, PaddlePageResult>;
  overallConfidence: number;
  paddleVersion?: string;
  processedCount: number;
  totalRequested: number;
  capped: boolean;
}

interface WorkerResult {
  engine?: string;
  model?: string;
  paddleVersion?: string | null;
  error?: string | null;
  pages?: Array<{
    pageNumber: number;
    text: string;
    confidence: number;
    wordCount: number;
    error?: string;
  }>;
}

/**
 * Local OCR service backed by PaddleOCR (PP-OCRv5 Devanagari model).
 *
 * The Devanagari multilingual recognition model supports BOTH Marathi and
 * English, so a single local engine handles mixed English-Marathi scanned
 * legal documents without any external API or credentials.
 *
 * This service replaces the former Azure AI Document Intelligence dependency.
 * It shells out to a long-lived Python worker (server/ocr/paddle_ocr_worker.py)
 * that renders scanned PDF pages to images (PyMuPDF) and runs PaddleOCR.
 */
export class PaddleOcrService {
  /** Local engine needs no credentials - it is always considered available. */
  static isConfigured(): boolean {
    return true;
  }

  /** Absolute path to the Python worker script that performs the actual OCR. */
  private static resolveWorkerPath(): string {
    // The server is started from the `server/` directory (see package.json
    // scripts and UPLOAD_DIR resolution in config), so cwd is server/.
    const worker = path.resolve(process.cwd(), 'ocr', 'paddle_ocr_worker.py');
    if (!fs.existsSync(worker)) {
      throw new Error(
        `PaddleOCR worker script not found at ${worker}. Ensure server/ocr/paddle_ocr_worker.py exists.`
      );
    }
    return worker;
  }

  // ---------------------------------------------------------------------------
  // Persistent worker process.
  //
  // The Python interpreter + PaddleOCR model are loaded ONCE and reused for
  // every OCR job (newline-delimited JSON over stdin/stdout). This avoids the
  // multi-second model-load cost that a fresh process-per-upload incurred.
  // ---------------------------------------------------------------------------
  private static worker: ChildProcess | null = null;
  private static stdoutBuf = '';
  private static stderrTail = '';
  private static pending = new Map<
    number,
    { resolve: (r: WorkerResult) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }
  >();
  private static nextId = 1;

  /** Lazily spawn the persistent worker if it is not already running. */
  private static ensureWorker(): ChildProcess {
    if (this.worker && !this.worker.killed) {
      return this.worker;
    }

    const workerPath = this.resolveWorkerPath();
    const pythonBin = OCR_PYTHON;

    let child: ChildProcess;
    try {
      child = spawn(pythonBin, [workerPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
      });
    } catch (err: any) {
      throw new Error(
        `Failed to start the OCR Python interpreter "${pythonBin}". ` +
          `Set OCR_PYTHON in server/.env to your Python executable. Original: ${err?.message || err}`
      );
    }

    this.worker = child;
    this.stdoutBuf = '';
    this.stderrTail = '';

    child.stdout?.setEncoding('utf-8');
    child.stdout?.on('data', (d) => this.handleStdout(d));
    child.stderr?.setEncoding('utf-8');
    child.stderr?.on('data', (d) => {
      this.stderrTail = (this.stderrTail + d).slice(-8000);
    });

    child.on('error', (err) => {
      this.worker = null;
      this.failAllPending(
        new Error(
          `Could not launch OCR Python interpreter "${pythonBin}". Is Python installed and on PATH? ` +
            `Set OCR_PYTHON in server/.env. Original: ${err.message}`
        )
      );
    });

    child.on('close', (code) => {
      this.worker = null;
      this.failAllPending(
        new Error(
          `PaddleOCR worker exited (code ${code}). It will restart on the next request.` +
            (this.stderrTail ? `\nDetails:\n${this.stderrTail.trim().split('\n').slice(-6).join('\n')}` : '')
        )
      );
    });

    return child;
  }

  /** Buffer stdout and dispatch each complete newline-delimited JSON line. */
  private static handleStdout(chunk: string): void {
    PaddleOcrService.stdoutBuf += chunk;
    let idx: number;
    while ((idx = PaddleOcrService.stdoutBuf.indexOf('\n')) >= 0) {
      const line = PaddleOcrService.stdoutBuf.slice(0, idx).trim();
      PaddleOcrService.stdoutBuf = PaddleOcrService.stdoutBuf.slice(idx + 1);
      if (!line) continue;

      const parsed = PaddleOcrService.tryParse(line);
      if (!parsed) continue;

      const id = (parsed as any).id as number | null | undefined;
      const entry = typeof id === 'number' ? PaddleOcrService.pending.get(id) : undefined;
      if (entry) {
        clearTimeout(entry.timer);
        PaddleOcrService.pending.delete(id as number);
        entry.resolve(parsed);
      }
    }
  }

  private static failAllPending(err: Error): void {
    for (const [, entry] of PaddleOcrService.pending) {
      clearTimeout(entry.timer);
      entry.reject(err);
    }
    PaddleOcrService.pending.clear();
  }

  /**
   * Send a job to the persistent worker and resolve with its result. Enforces a
   * hard timeout; on timeout the worker is killed so it restarts cleanly.
   */
  private static runWorker(job: Record<string, unknown>): Promise<WorkerResult> {
    return new Promise<WorkerResult>((resolve, reject) => {
      let child: ChildProcess;
      try {
        child = this.ensureWorker();
      } catch (err: any) {
        reject(err instanceof Error ? err : new Error(String(err)));
        return;
      }

      const id = this.nextId++;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        // Kill the (likely stuck) worker; it respawns on the next request.
        try {
          child.kill('SIGKILL');
        } catch {
          /* ignore */
        }
        reject(
          new Error(
            `PaddleOCR worker timed out after ${Math.round(OCR_TIMEOUT_MS / 1000)}s. ` +
              `The document may be too large or the model is still downloading on first run.`
          )
        );
      }, OCR_TIMEOUT_MS);

      this.pending.set(id, { resolve, reject, timer });

      try {
        child.stdin?.write(JSON.stringify({ ...job, id }) + '\n');
      } catch (err: any) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(new Error(`Failed to send job to PaddleOCR worker: ${err?.message || err}`));
      }
    });
  }

  /**
   * Warm up the worker at server startup so the model loads in the background
   * and the first real upload is not delayed. Safe to call multiple times.
   */
  static async warmup(): Promise<void> {
    try {
      await this.runWorker({ action: 'warmup', lang: OCR_LANG });
      console.log('[PaddleOcrService] Worker warm-up complete (model cached).');
    } catch (err: any) {
      console.warn(
        '[PaddleOcrService] Warm-up failed (will retry lazily on first upload):',
        err?.message || err
      );
    }
  }

  /** Gracefully stop the persistent worker (e.g. on shutdown). */
  static shutdown(): void {
    if (this.worker && !this.worker.killed) {
      try {
        this.worker.stdin?.end();
      } catch {
        /* ignore */
      }
      try {
        this.worker.kill();
      } catch {
        /* ignore */
      }
    }
    this.worker = null;
    this.failAllPending(new Error('PaddleOCR worker was shut down.'));
  }

  private static tryParse(raw: string): WorkerResult | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed) as WorkerResult;
    } catch {
      // The worker may emit extra trailing whitespace; try the last JSON object.
      const start = trimmed.indexOf('{');
      const end = trimmed.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(trimmed.slice(start, end + 1)) as WorkerResult;
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  /**
   * OCR only the scanned pages of a PDF.
   *
   * @param filePath  Absolute path to the source PDF on disk.
   * @param pageNumbers  1-based page numbers that were detected as scanned.
   * @returns Per-page OCR results keyed by page number, plus aggregate stats.
   *
   * Selectable pages are NOT passed here - they are extracted directly by
   * PdfService and merged afterwards, preserving page numbers and boundaries.
   */
  static async analyzeScannedPages(
    filePath: string,
    pageNumbers: number[]
  ): Promise<PaddleScannedResult> {
    const uniquePages = Array.from(new Set(pageNumbers))
      .filter((p) => Number.isFinite(p) && p >= 1)
      .sort((a, b) => a - b);

    const empty: PaddleScannedResult = {
      pages: new Map(),
      overallConfidence: 0,
      processedCount: 0,
      totalRequested: uniquePages.length,
      capped: false,
    };

    if (uniquePages.length === 0) {
      return empty;
    }
    if (!fs.existsSync(filePath)) {
      throw new Error(`Source PDF not found for OCR: ${filePath}`);
    }

    // Guard against oversized documents (requirement: handle oversized PDFs).
    let pagesToProcess = uniquePages;
    let capped = false;
    if (uniquePages.length > OCR_MAX_PAGES) {
      console.warn(
        `[PaddleOcrService] ${uniquePages.length} scanned pages requested; ` +
          `capping OCR to first ${OCR_MAX_PAGES} (OCR_MAX_PAGES).`
      );
      pagesToProcess = uniquePages.slice(0, OCR_MAX_PAGES);
      capped = true;
    }

    // A private render directory for this job (worker writes PNGs here when
    // it is not given pre-rendered images). Made unique per job so concurrent
    // uploads sharing the persistent worker never collide on filenames.
    const renderDir = path.join(
      UPLOAD_DIR,
      'ocr_render',
      `job_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    );
    fs.mkdirSync(renderDir, { recursive: true });

    const job = {
      pdfPath: filePath,
      pages: pagesToProcess.map((pageNumber) => ({ pageNumber })),
      dpi: OCR_DPI,
      lang: OCR_LANG,
      renderDir,
    };

    console.log(
      `[PaddleOcrService] Running local PaddleOCR (${OCR_LANG}) on ` +
        `${pagesToProcess.length} scanned page(s)...`
    );

    let result: WorkerResult;
    try {
      result = await this.runWorker(job);
    } finally {
      // Best-effort cleanup of rendered images.
      try {
        fs.rmSync(renderDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }

    if (result.error) {
      throw new Error(result.error);
    }

    const pages = new Map<number, PaddlePageResult>();
    let confSum = 0;
    for (const p of result.pages || []) {
      const text = (p.text || '').trim();
      const lineCount = text ? text.split('\n').filter(Boolean).length : 0;
      const confidence =
        typeof p.confidence === 'number' ? Math.round(p.confidence * 1000) / 1000 : 0;
      pages.set(p.pageNumber, {
        pageNumber: p.pageNumber,
        text,
        confidence,
        wordCount: typeof p.wordCount === 'number' ? p.wordCount : text.split(/\s+/).filter(Boolean).length,
        lineCount,
        error: p.error,
      });
      confSum += confidence;
    }

    const overallConfidence =
      pages.size > 0 ? Math.round((confSum / pages.size) * 1000) / 1000 : 0;

    return {
      pages,
      overallConfidence,
      paddleVersion: result.paddleVersion || undefined,
      processedCount: pages.size,
      totalRequested: uniquePages.length,
      capped,
    };
  }
}

