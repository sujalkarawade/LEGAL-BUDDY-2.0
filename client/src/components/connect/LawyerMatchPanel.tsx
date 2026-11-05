import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Scale, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { ConnectApi } from '../../services/connectApi.js';
import type { LawyerMatchResult } from '../../types/connect.js';

/**
 * Phase 3: suggests practice areas from this document's stored clause analysis. Loaded only when
 * the user asks, and the request carries only the document id: the server reads category/risk
 * labels, never contract text, and nothing about the document is sent to any lawyer.
 */
export const LawyerMatchPanel: React.FC<{ documentId: string }> = ({ documentId }) => {
  const [result, setResult] = useState<LawyerMatchResult | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && !result) {
      setLoading(true);
      try { setResult(await ConnectApi.lawyerMatch(documentId)); } catch (e: any) { setError(e.message); }
      finally { setLoading(false); }
    }
  };

  return (
    <section className="card" style={{ marginBottom: 20 }}>
      <button type="button" onClick={toggle} aria-expanded={open}
        style={{ all: 'unset', cursor: 'pointer', display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="icon-box"><Scale size={18} /></span>
          <span>
            <strong style={{ display: 'block', color: 'var(--text-primary)' }}>Need a lawyer for this contract?</strong>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>See which practice areas the detected issues relate to, then find verified lawyers near you.</span>
          </span>
        </span>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {open && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading && <div className="spinner" />}
          {error && <div className="alert alert-error">{error}</div>}
          {result && (
            <>
              <p>{result.message}</p>
              {result.suggestions.map(s => (
                <div key={s.slug} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Suggested specialization: {s.name}</strong>
                    <Link className="btn btn-primary btn-sm" to={`/connect/find?specialization=${encodeURIComponent(s.slug)}`}>Find {s.name} lawyers near me</Link>
                  </div>
                  <p className="section-label" style={{ marginTop: 10 }}>Why this is suggested</p>
                  <ul style={{ margin: '4px 0 0 18px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    {s.reasons.map(r => <li key={r}>{r}</li>)}
                  </ul>
                </div>
              ))}
              <Link to="/connect/find" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }}>Ignore suggestions and search all lawyers</Link>
              <p style={{ display: 'flex', gap: 6, fontSize: '0.8125rem', color: 'var(--text-muted)' }}><Info size={14} style={{ flexShrink: 0, marginTop: 3 }} /> {result.disclaimer}</p>
            </>
          )}
        </div>
      )}
    </section>
  );
};
