// Runs the hand-labelled clause / Indian-law benchmark and saves results for the Evaluation dashboard.
//   npm run eval:clauses
// Offline and deterministic: no database, network or AI provider is used.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { runClauseBenchmark, type BenchmarkCase } from '../src/services/insights/clause-benchmark.js';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'evaluations');
const raw = fs.readFileSync(path.join(dir, 'clause-cases.json'), 'utf8');
const fixture = JSON.parse(raw) as { notice: string; cases: BenchmarkCase[] };
const result = runClauseBenchmark(fixture.cases);

const output = {
  executedAt: new Date().toISOString(),
  fixtureSha256: createHash('sha256').update(raw).digest('hex'),
  engine: 'RuleEngineService.analyzeClauses + runIndianLawChecks (deterministic, offline)',
  notice: fixture.notice,
  ...result,
};
fs.writeFileSync(path.join(dir, 'last-clause-results.json'), `${JSON.stringify(output, null, 2)}\n`);

const pct = (v: number | null) => (v === null ? 'n/a' : `${(v * 100).toFixed(1)}%`);
console.log(`Clause benchmark — ${result.cases} synthetic labelled cases`);
console.log(`  Clause detection   precision ${pct(result.clauseDetection.overall.precision)}  recall ${pct(result.clauseDetection.overall.recall)}  F1 ${pct(result.clauseDetection.overall.f1)}`);
console.log(`  Risk level agreement ${result.riskLevelAgreement.agreed}/${result.riskLevelAgreement.compared} (${pct(result.riskLevelAgreement.rate)})`);
console.log(`  Indian law checks  precision ${pct(result.indianLawChecks.overall.precision)}  recall ${pct(result.indianLawChecks.overall.recall)}  F1 ${pct(result.indianLawChecks.overall.f1)}`);
console.log(`  Saved evaluations/last-clause-results.json`);
