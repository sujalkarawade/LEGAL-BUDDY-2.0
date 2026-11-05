import React, { useEffect, useState } from 'react';
import { BarChart3, FlaskConical, Info } from 'lucide-react';
import { InsightsApi } from '../services/insightsApi.js';
import type { EvaluationSummary, MetricRow } from '../types/insights.js';

const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${Math.round(v * 1000) / 10}%`);
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString() : 'not run');

const Tile: React.FC<{ label: string; value: string; sub?: string }> = ({ label, value, sub }) => (
  <div className="stat-card">
    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{label}</span>
    <strong style={{ fontSize: '1.6rem' }}>{value}</strong>
    {sub && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sub}</span>}
  </div>
);

/** Horizontal precision / recall bars per category (no chart library needed). */
const MetricBars: React.FC<{ rows: MetricRow[] }> = ({ rows }) => (
  <div className="lb-metric-table" role="table" aria-label="Precision and recall by category">
    <div role="row" className="lb-metric-head"><span>Category</span><span>Precision</span><span>Recall</span><span>TP / FP / FN</span></div>
    {rows.map(r => (
      <div role="row" key={r.key} className="lb-metric-row">
        <span>{r.key.replace(/_/g, ' ')}</span>
        <span className="lb-bar"><span style={{ width: `${(r.precision ?? 0) * 100}%` }} className="is-precision" /><em>{pct(r.precision)}</em></span>
        <span className="lb-bar"><span style={{ width: `${(r.recall ?? 0) * 100}%` }} className="is-recall" /><em>{pct(r.recall)}</em></span>
        <span style={{ color: 'var(--text-muted)' }}>{r.tp} / {r.fp} / {r.fn}</span>
      </div>
    ))}
  </div>
);

export const EvaluationPage: React.FC = () => {
  const [data, setData] = useState<EvaluationSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { InsightsApi.evaluationSummary().then(setData).catch(e => setError(e.message)); }, []);

  const cb = data?.clauseBenchmark;
  return (
    <div className="page-wrapper animate-fade-in">
      <div className="page-header">
        <div className="page-header-text">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}><BarChart3 size={22} /> Accuracy &amp; evaluation</h1>
          <p>Measured results from Legal Buddy's evaluation scripts. Each section shows when it was run and exactly what it covers.</p>
        </div>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {!data && !error && <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <section className="card">
            <div className="card-header"><h2>Clause detection &amp; Indian law checks</h2><span className="badge badge-default">{when(cb?.executedAt)}</span></div>
            {!cb ? (
              <p>Not run yet. From the <code>server</code> folder run <code>{data.howToRefresh.clauseBenchmark}</code>.</p>
            ) : (
              <>
                <div className="lb-stat-row">
                  <Tile label="Clause detection F1" value={pct(cb.clauseDetection.overall.f1)} sub={`precision ${pct(cb.clauseDetection.overall.precision)} · recall ${pct(cb.clauseDetection.overall.recall)}`} />
                  <Tile label="Risk level agreement" value={pct(cb.riskLevelAgreement.rate)} sub={`${cb.riskLevelAgreement.agreed} of ${cb.riskLevelAgreement.compared} detected clauses`} />
                  <Tile label="Indian law checks F1" value={pct(cb.indianLawChecks.overall.f1)} sub={`precision ${pct(cb.indianLawChecks.overall.precision)} · recall ${pct(cb.indianLawChecks.overall.recall)}`} />
                  <Tile label="Labelled cases" value={String(cb.cases)} sub="synthetic, hand-labelled" />
                </div>
                <h3 className="lb-section-title" style={{ marginTop: 18 }}>By clause category</h3>
                <MetricBars rows={cb.clauseDetection.byCategory} />
                <h3 className="lb-section-title" style={{ marginTop: 18 }}>By Indian law rule</h3>
                <MetricBars rows={cb.indianLawChecks.byRule} />
                <details style={{ marginTop: 14 }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Per-case results</summary>
                  <div className="table-wrapper" style={{ marginTop: 10 }}>
                    <table>
                      <thead><tr><th>Case</th><th>Clauses (TP / FP / FN)</th><th>Law rules (TP / FP / FN)</th></tr></thead>
                      <tbody>
                        {cb.rows.map(r => {
                          const c = (res: string) => r.clauses.filter(x => x.result === res).map(x => x.category).join(', ') || '—';
                          const l = (res: string) => r.compliance.filter(x => x.result === res).map(x => x.ruleId).join(', ') || '—';
                          return (
                            <tr key={r.id}>
                              <td>{r.id}</td>
                              <td style={{ fontSize: '0.8125rem' }}>✓ {c('TP')}<br />+ {c('FP')}<br />✗ {c('FN')}</td>
                              <td style={{ fontSize: '0.8125rem' }}>✓ {l('TP')}<br />+ {l('FP')}<br />✗ {l('FN')}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </details>
                <p className="lb-eval-notice"><Info size={14} /> {cb.notice} Fixture SHA-256 {cb.fixtureSha256.slice(0, 12)}…</p>
              </>
            )}
          </section>

          <section className="card">
            <div className="card-header"><h2>Document question answering — retrieval</h2><span className="badge badge-default">{when(data.retrieval?.executedAt)}</span></div>
            {!data.retrieval ? <p>Not run. Use <code>{data.howToRefresh.retrieval}</code>.</p> : (
              <>
                <div className="lb-stat-row">
                  <Tile label="Correct passage found" value={`${data.retrieval.passageRetrieved}/${data.retrieval.cases}`} />
                  <Tile label="Correct page cited" value={`${data.retrieval.correctPage}/${data.retrieval.cases}`} />
                  <Tile label="Citation validated" value={`${data.retrieval.citationValidated}/${data.retrieval.cases}`} />
                  <Tile label="Median retrieval time" value={data.retrieval.medianRetrievalMs === null ? '—' : `${data.retrieval.medianRetrievalMs} ms`} sub={`mode: ${data.retrieval.mode}`} />
                </div>
                <p className="lb-eval-notice"><Info size={14} /> {data.retrieval.notice}</p>
              </>
            )}
          </section>

          <section className="card">
            <div className="card-header"><h2>Search ranking — keyword vs semantic vs hybrid</h2><span className="badge badge-default">{when(data.hybridSearch?.executedAt)}</span></div>
            {!data.hybridSearch ? <p>Not run. Use <code>{data.howToRefresh.hybridSearch}</code>.</p> : (
              <>
                <div className="table-wrapper">
                  <table>
                    <thead><tr><th>Mode</th><th>Top-1 hits</th><th>Recall@3</th><th>MRR@3</th><th>Median latency</th></tr></thead>
                    <tbody>
                      {data.hybridSearch.modes.map(m => (
                        <tr key={m.mode}><td>{m.mode.replace(/_/g, ' ')}</td><td>{m.top1Hits}/{m.cases}</td><td>{pct(m.recallAt3)}</td><td>{m.mrrAt3?.toFixed(3)}</td><td>{m.p50Ms?.toFixed(2)} ms</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="lb-eval-notice"><Info size={14} /> {data.hybridSearch.notice}</p>
              </>
            )}
          </section>

          <section className="card">
            <div className="card-header"><h2>End-to-end application checks</h2><span className="badge badge-default">{when(data.endToEnd?.executedAt)}</span></div>
            {!data.endToEnd ? <p>Not run. Use <code>{data.howToRefresh.endToEnd}</code>.</p> : (
              <>
                <div className="lb-stat-row"><Tile label="Checks passed" value={`${data.endToEnd.passed}/${data.endToEnd.total}`} /></div>
                {data.endToEnd.failed.length > 0 && <p style={{ marginTop: 10 }}><strong>Failed:</strong> {data.endToEnd.failed.join('; ')}</p>}
              </>
            )}
          </section>

          <p className="lb-eval-notice"><FlaskConical size={14} /> These figures come from small, mostly synthetic test sets. They show how the system behaves on known cases and help catch regressions; they are not a guarantee of accuracy on real contracts.</p>
        </div>
      )}
    </div>
  );
};
