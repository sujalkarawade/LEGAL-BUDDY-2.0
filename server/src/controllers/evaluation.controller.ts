import { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';

const EVAL_DIR = path.resolve(process.cwd(), 'evaluations');

function readJson(name: string): any | null {
  try { return JSON.parse(fs.readFileSync(path.join(EVAL_DIR, name), 'utf8')); } catch { return null; }
}

/**
 * Serves the saved evaluation results for the Accuracy & Evaluation dashboard. It only reports what
 * the evaluation scripts actually recorded (with their own scope notices); nothing is computed or
 * estimated here, and a missing result is reported as "not run" rather than as a number.
 */
export class EvaluationController {
  static summary(_req: Request, res: Response): void {
    const clause = readJson('last-clause-results.json');
    const retrieval = readJson('last-retrieval-results.json');
    const hybrid = readJson('last-hybrid-results.json');
    const e2e = readJson('last-e2e-results.json');

    const retrievalRows: any[] = Array.isArray(retrieval?.rows) ? retrieval.rows : [];
    res.json({
      clauseBenchmark: clause ? {
        executedAt: clause.executedAt, notice: clause.notice, cases: clause.cases, fixtureSha256: clause.fixtureSha256,
        clauseDetection: clause.clauseDetection, riskLevelAgreement: clause.riskLevelAgreement,
        indianLawChecks: clause.indianLawChecks, fallbackGeneralSections: clause.fallbackGeneralSections, rows: clause.rows,
      } : null,
      retrieval: retrieval ? {
        executedAt: retrieval.executedAt, mode: retrieval.mode, notice: retrieval.data,
        cases: retrievalRows.length,
        passageRetrieved: retrievalRows.filter(r => r.correctPassageRetrieved).length,
        correctPage: retrievalRows.filter(r => r.correctPage).length,
        citationValidated: retrievalRows.filter(r => r.citationValidationPassed).length,
        medianRetrievalMs: median(retrievalRows.map(r => Number(r.retrievalMs)).filter(Number.isFinite)),
      } : null,
      hybridSearch: hybrid?.summary ? {
        executedAt: hybrid.executedAt, notice: hybrid.scope,
        modes: Object.entries(hybrid.summary).map(([mode, s]: [string, any]) => ({
          mode, cases: s.supportedCases, top1Hits: s.top1Hits, recallAt3: s.meanRecallAt3, mrrAt3: s.meanReciprocalRankAt3, p50Ms: s.warmRetrievalP50Ms,
        })),
      } : null,
      endToEnd: e2e ? {
        executedAt: e2e.executedAt, passed: e2e.passedTests, total: e2e.totalTests,
        failed: Array.isArray(e2e.checks) ? e2e.checks.filter((c: any) => !c.passed).map((c: any) => c.name) : [],
      } : null,
      howToRefresh: {
        clauseBenchmark: 'npm run eval:clauses (offline)',
        retrieval: 'npm run eval:rag',
        hybridSearch: 'npm run eval:hybrid',
        endToEnd: 'npx tsx scripts/test-e2e.ts (needs the running app and seeded users)',
      },
    });
  }
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return Math.round((s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2) * 100) / 100;
}
