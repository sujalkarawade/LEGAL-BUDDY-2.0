import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import path from 'node:path';
import {
  RAG_EMBEDDING_ENABLED, RAG_EMBEDDING_MODEL_PATH, RAG_EMBEDDING_PYTHON,
  RAG_EMBEDDING_STARTUP_MS, RAG_EMBEDDING_TIMEOUT_MS,
} from '../config/index.js';

export interface EmbeddingInfo { signature: string; dimensions: number }

export function validVector(value: unknown, dimensions: number): value is number[] {
  return Array.isArray(value) && value.length === dimensions && value.every(Number.isFinite) && value.some(n => n !== 0);
}

export class LocalEmbeddingService {
  static get enabled(): boolean { return RAG_EMBEDDING_ENABLED; }
  private static worker: ChildProcessWithoutNullStreams | null = null;
  private static ready: Promise<EmbeddingInfo> | null = null;
  private static sequence = 0;
  private static retryAfter = 0;
  private static pending = new Map<number, { resolve: (v: number[][]) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>();
  private static rejectStartup: ((e: Error) => void) | null = null;

  static async getInfo(): Promise<EmbeddingInfo | null> {
    if (!this.enabled) return null;
    if (this.ready) return this.ready;
    if (Date.now() < this.retryAfter) throw new Error('Local embedding worker is cooling down.');
    this.ready = new Promise<EmbeddingInfo>((resolve, reject) => {
      this.rejectStartup = reject;
      const timer = setTimeout(() => this.fail(), RAG_EMBEDDING_STARTUP_MS);
      const worker = spawn(RAG_EMBEDDING_PYTHON, ['-u', path.resolve(process.cwd(), 'retrieval/embedding_worker.py'), RAG_EMBEDDING_MODEL_PATH],
        { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      this.worker = worker;
      worker.stderr.resume(); // Library diagnostics may contain input; never forward stderr.
      const lines = createInterface({ input: worker.stdout });
      lines.on('line', line => {
        if (this.worker !== worker) return;
        if (line.length > 4_000_000) { this.fail(); return; }
        try {
          const data = JSON.parse(line);
          if (data.type === 'ready') {
            if (typeof data.signature !== 'string' || !Number.isInteger(data.dimensions) || data.dimensions < 1 || data.dimensions > 4096) {
              this.fail(); return;
            }
            clearTimeout(timer); this.rejectStartup = null;
            resolve({ signature: data.signature, dimensions: data.dimensions });
          } else if (data.type === 'error') { this.fail(); }
          else {
            const entry = this.pending.get(data.id);
            if (!entry) return;
            this.pending.delete(data.id); clearTimeout(entry.timer);
            if (data.error) entry.reject(new Error('Local embedding request failed.'));
            else entry.resolve(data.vectors);
          }
        } catch { this.fail(); }
      });
      const ended = () => { clearTimeout(timer); lines.close(); if (this.worker === worker) this.fail(); };
      worker.on('error', ended); worker.on('exit', ended);
    });
    return this.ready;
  }

  static async embed(texts: string[], task: 'document' | 'query' = 'document'): Promise<number[][]> {
    if (!texts.length || texts.length > 8 || texts.some(t => !t.trim() || t.length > 6000)) throw new Error('Invalid embedding input.');
    const info = await this.getInfo();
    if (!info || !this.worker) throw new Error('Local embeddings are disabled.');
    if (this.pending.size >= 16) throw new Error('Local embedding queue is full.');
    const id = ++this.sequence;
    const vectors = await new Promise<number[][]>((resolve, reject) => {
      const timer = setTimeout(() => this.fail(), RAG_EMBEDDING_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      this.worker!.stdin.write(JSON.stringify({ id, texts, task }) + '\n', error => { if (error) this.fail(); });
    });
    if (!Array.isArray(vectors) || vectors.length !== texts.length || vectors.some(v => !validVector(v, info.dimensions))) {
      throw new Error('Invalid local embedding response.');
    }
    return vectors;
  }

  private static fail(): void {
    const worker = this.worker;
    this.worker = null; this.ready = null; this.retryAfter = Date.now() + 5000;
    this.rejectStartup?.(new Error('Local embedding worker unavailable.')); this.rejectStartup = null;
    for (const entry of this.pending.values()) { clearTimeout(entry.timer); entry.reject(new Error('Local embedding worker unavailable.')); }
    this.pending.clear(); worker?.kill();
  }
  static shutdown(): void { this.fail(); this.retryAfter = 0; }
}
