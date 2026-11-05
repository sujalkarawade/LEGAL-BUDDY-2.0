import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Gauge, ChevronDown, ChevronUp } from 'lucide-react';
import type { RiskScore } from '../../types/insights.js';

const BAND_COLOR: Record<RiskScore['band'], string> = {
  Low: 'var(--success)', Moderate: 'var(--warning)', High: '#c2410c', 'Very high': 'var(--danger)',
};

/** Headline risk indicator with a fully traceable breakdown. */
export const RiskScoreCard: React.FC<{ risk: RiskScore; documentId?: string; compact?: boolean }> = ({ risk, documentId, compact }) => {
  const [open, setOpen] = useState(!compact);
  const color = BAND_COLOR[risk.band];
  const parts: Array<[string, number, number]> = [
    ['Clause analysis', risk.components.clauses, 50],
    ['Completeness', risk.components.completeness, 25],
    ['Indian law checks', risk.components.compliance, 25],
  ];

  return (
    <section className="card lb-risk-card" aria-label="Contract risk score">
      <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="lb-risk-dial" style={{ ['--risk' as any]: `${risk.score * 3.6}deg`, ['--risk-color' as any]: color }} role="img" aria-label={`Risk score ${risk.score} out of 100, ${risk.band}`}>
          <span><strong>{risk.score}</strong><small>/100</small></span>
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <p className="section-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Gauge size={14} /> Overall risk indicator</p>
          <p style={{ fontSize: '1.25rem', fontWeight: 700, color }}>{risk.band} risk</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            {parts.map(([label, value, max]) => (
              <div key={label} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 52px', gap: 8, alignItems: 'center', fontSize: '0.8125rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                <span className="lb-progress"><span style={{ width: `${(value / max) * 100}%`, background: color }} /></span>
                <span style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{value}/{max}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => setOpen(o => !o)} aria-expanded={open}>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Why this score?
      </button>
      {open && (
        <div style={{ marginTop: 8 }}>
          {risk.contributions.length === 0 ? <p style={{ fontSize: '0.875rem' }}>No risk signals were found by the automated checks.</p> : (
            <ul className="lb-contrib-list">
              {risk.contributions.map((c, i) => (
                <li key={i}><span className="badge badge-default">{c.source}</span><span>{c.label}</span><strong>+{c.points}</strong></li>
              ))}
            </ul>
          )}
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 10 }}>{risk.method}</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>{risk.disclaimer}</p>
          {documentId && <Link to={`/documents/${documentId}/compliance`} style={{ fontSize: '0.8125rem', color: 'var(--info)' }}>See the Indian law checks</Link>}
        </div>
      )}
    </section>
  );
};
