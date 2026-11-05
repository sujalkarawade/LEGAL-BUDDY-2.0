import { RuleEngineService } from '../ai/rule-engine.js';
import { runIndianLawChecks } from './indian-law-checks.js';

/** Scores the deterministic clause engine and Indian-law rules against hand-labelled cases. */

export interface BenchmarkCase {
  id: string;
  text: string;
  clauses: Array<{ category: string; risk: string }>;
  compliance: string[];
}

export interface Counts { tp: number; fp: number; fn: number }
export interface Metrics extends Counts { precision: number | null; recall: number | null; f1: number | null }

export function toMetrics(c: Counts): Metrics {
  const precision = c.tp + c.fp ? c.tp / (c.tp + c.fp) : null;
  const recall = c.tp + c.fn ? c.tp / (c.tp + c.fn) : null;
  const f1 = precision !== null && recall !== null && precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : null;
  const r = (v: number | null) => (v === null ? null : Math.round(v * 1000) / 1000);
  return { ...c, precision: r(precision), recall: r(recall), f1: r(f1) };
}

const add = (map: Map<string, Counts>, key: string, field: keyof Counts) => {
  const c = map.get(key) || { tp: 0, fp: 0, fn: 0 };
  c[field] += 1;
  map.set(key, c);
};

export function runClauseBenchmark(cases: BenchmarkCase[]) {
  const clauseByCategory = new Map<string, Counts>();
  const ruleById = new Map<string, Counts>();
  let riskCompared = 0;
  let riskAgreed = 0;
  let fallbackSections = 0;
  const startedAt = performance.now();

  const rows = cases.map(c => {
    const t0 = performance.now();
    const detected = RuleEngineService.analyzeClauses(c.text);
    const named = detected.filter(d => d.category !== 'General Terms');
    fallbackSections += detected.length - named.length;
    const expected = new Map(c.clauses.map(e => [e.category, e.risk]));
    const found = new Map(named.map(d => [d.category, d.riskLevel as string]));

    const clauseDetail: Array<{ category: string; result: 'TP' | 'FP' | 'FN'; expectedRisk?: string; detectedRisk?: string }> = [];
    for (const [category, risk] of expected) {
      if (found.has(category)) {
        add(clauseByCategory, category, 'tp');
        riskCompared += 1;
        if (found.get(category) === risk) riskAgreed += 1;
        clauseDetail.push({ category, result: 'TP', expectedRisk: risk, detectedRisk: found.get(category) });
      } else {
        add(clauseByCategory, category, 'fn');
        clauseDetail.push({ category, result: 'FN', expectedRisk: risk });
      }
    }
    for (const [category, risk] of found) {
      if (!expected.has(category)) { add(clauseByCategory, category, 'fp'); clauseDetail.push({ category, result: 'FP', detectedRisk: risk }); }
    }

    const flagged = new Set(runIndianLawChecks(c.text).findings.map(f => f.ruleId));
    const wanted = new Set(c.compliance);
    const ruleDetail: Array<{ ruleId: string; result: 'TP' | 'FP' | 'FN' }> = [];
    for (const id of wanted) { const hit = flagged.has(id); add(ruleById, id, hit ? 'tp' : 'fn'); ruleDetail.push({ ruleId: id, result: hit ? 'TP' : 'FN' }); }
    for (const id of flagged) if (!wanted.has(id)) { add(ruleById, id, 'fp'); ruleDetail.push({ ruleId: id, result: 'FP' }); }

    return { id: c.id, clauses: clauseDetail, compliance: ruleDetail, ms: Math.round((performance.now() - t0) * 100) / 100 };
  });

  const sum = (m: Map<string, Counts>) => [...m.values()].reduce((a, c) => ({ tp: a.tp + c.tp, fp: a.fp + c.fp, fn: a.fn + c.fn }), { tp: 0, fp: 0, fn: 0 });
  const table = (m: Map<string, Counts>) => [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, c]) => ({ key, ...toMetrics(c) }));

  return {
    cases: cases.length,
    clauseDetection: { overall: toMetrics(sum(clauseByCategory)), byCategory: table(clauseByCategory) },
    riskLevelAgreement: { compared: riskCompared, agreed: riskAgreed, rate: riskCompared ? Math.round((riskAgreed / riskCompared) * 1000) / 1000 : null },
    indianLawChecks: { overall: toMetrics(sum(ruleById)), byRule: table(ruleById) },
    fallbackGeneralSections: fallbackSections,
    totalMs: Math.round((performance.now() - startedAt) * 100) / 100,
    rows,
  };
}
