import { randomUUID } from 'crypto';

export interface DocumentJobProgress {
  completedPages: number;
  totalPages: number;
  percent: number;
  currentStage: string;
  scannedPagesCount?: number;
  selectablePagesCount?: number;
}

export interface DocumentJob {
  id: string;
  documentId: string;
  userId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress: DocumentJobProgress;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  error?: string | null;
  result?: {
    documentId: string;
    pageCount: number;
    ocrStatus: string;
    hasLowConfidencePages: boolean;
  };
}

export class JobQueueService {
  private static jobs = new Map<string, DocumentJob>();

  /** Create a new background processing job */
  static createJob(documentId: string, userId: string, totalPages: number = 0): DocumentJob {
    const id = randomUUID();

    const job: DocumentJob = {
      id,
      documentId,
      userId,
      status: 'PROCESSING',
      progress: {
        completedPages: 0,
        totalPages,
        percent: 0,
        currentStage: 'Document uploaded. Starting extraction pipeline...',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      error: null,
    };

    this.jobs.set(id, job);

    // Keep memory tidy: delete jobs older than 24 hours
    this.cleanupOldJobs();

    return job;
  }

  /** Retrieve job by jobId */
  static getJob(jobId: string): DocumentJob | undefined {
    return this.jobs.get(jobId);
  }

  /** Retrieve active or latest job for a specific documentId */
  static getJobByDocumentId(documentId: string): DocumentJob | undefined {
    for (const job of Array.from(this.jobs.values()).reverse()) {
      if (job.documentId === documentId) {
        return job;
      }
    }
    return undefined;
  }

  /** Update real-time progress for a job */
  static updateProgress(
    jobId: string,
    completedPages: number,
    totalPages: number,
    stage: string,
    extra?: { scannedPagesCount?: number; selectablePagesCount?: number }
  ): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    const safeTotal = Math.max(totalPages, completedPages, 1);
    const percent = Math.min(100, Math.round((completedPages / safeTotal) * 100));

    job.progress = {
      completedPages,
      totalPages: safeTotal,
      percent,
      currentStage: stage,
      scannedPagesCount: extra?.scannedPagesCount ?? job.progress.scannedPagesCount,
      selectablePagesCount: extra?.selectablePagesCount ?? job.progress.selectablePagesCount,
    };
    job.updatedAt = new Date();
  }

  /** Mark job as COMPLETED */
  static completeJob(
    jobId: string,
    result?: { documentId: string; pageCount: number; ocrStatus: string; hasLowConfidencePages: boolean }
  ): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = 'COMPLETED';
    job.progress.percent = 100;
    job.progress.completedPages = job.progress.totalPages;
    job.progress.currentStage = 'Legal intelligence scan and analysis complete.';
    job.completedAt = new Date();
    job.updatedAt = new Date();
    job.result = result;
  }

  /** Mark job as FAILED */
  static failJob(jobId: string, error: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = 'FAILED';
    job.error = error;
    job.progress.currentStage = `Processing error: ${error}`;
    job.updatedAt = new Date();
  }

  private static cleanupOldJobs(): void {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const [id, job] of this.jobs.entries()) {
      if (job.createdAt.getTime() < cutoff) {
        this.jobs.delete(id);
      }
    }
  }
}
