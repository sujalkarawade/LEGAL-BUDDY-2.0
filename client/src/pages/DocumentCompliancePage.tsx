import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Landmark, AlertTriangle, Info, CheckCircle2, ExternalLink } from 'lucide-react';
import ApiService from '../services/api.js';
import { InsightsApi } from '../services/insightsApi.js';
import { DocumentNavHeader } from '../components/document/DocumentNavHeader.js';
import { RiskScoreCard } from '../components/insights/RiskScoreCard.js';
import type { DocumentRecord } from '../types/index.js';
import type { DocumentInsights, ComplianceSeverity } from '../types/insights.js';

const SEVERITY: Record<ComplianceSeverity, { label: string; cls: string; icon: React.ReactNode }> = {
  IMPORTANT: { label: 'Important — ask a lawyer', cls: 'badge-danger', icon: <AlertTriangle size={12} /> },
  REVIEW: { label: 'Review recommended', cls: 'badge-warning', icon: <AlertTriangle size={12} /> },
  INFO: { label: 'For information', cls: 'badge-info', icon: <Info size={12} /> },
};

export const DocumentCompliancePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [data, setData] = useState<DocumentInsights | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    ApiService.getDocumentById(id).then(r => setDocument(r.document)).catch(() => undefined);
    InsightsApi.insights(id).then(setData).catch(e => setError(e.message));
  }, [id]);

  return (
    <div className="animate-fade-in" style={{ width: '100%' }}>
      <DocumentNavHeader document={document} />
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div className="page-header-text">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Landmark size={22} /> Indian law checks</h1>
          <p>Rule-based flags against selected provisions of Indian law, each with the section it relies on.</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {!data && !error && <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>}
      {data && !data.analysed && (
        <div className="card empty-state"><h3>No extracted text yet</h3><p>Finish processing (or OCR review) of this document first.</p></div>
      )}

      {data?.analysed && data.compliance && data.riskScore && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <RiskScoreCard risk={data.riskScore} compact />

          <section className="card">
            <div className="card-header" style={{ marginBottom: 12 }}>
              <h2>{data.compliance.findings.length} {data.compliance.findings.length === 1 ? 'flag' : 'flags'}</h2>
              <span className="badge badge-default">{data.compliance.rulesEvaluated} rules checked</span>
            </div>
            {data.compliance.findings.length === 0 ? (
              <div className="empty-state" style={{ padding: 24 }}>
                <div className="empty-state-icon"><CheckCircle2 size={22} /></div>
                <h3>No rule was triggered</h3>
                <p>That does not mean the contract complies with every law — only that none of these specific checks matched.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {data.compliance.findings.map(f => (
                  <article key={f.ruleId} className="lb-law-finding" data-severity={f.severity}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                      <div>
                        <h3 style={{ fontSize: '1rem' }}>{f.title}</h3>
                        <p style={{ fontSize: '0.8125rem', marginTop: 2 }}><strong style={{ color: 'var(--text-primary)' }}>{f.statute}</strong> · {f.provision}</p>
                      </div>
                      <span className={`badge ${SEVERITY[f.severity].cls}`}>{SEVERITY[f.severity].icon} {SEVERITY[f.severity].label}</span>
                    </div>
                    <p style={{ marginTop: 10, color: 'var(--text-primary)' }}><strong>Why it was flagged:</strong> {f.whyFlagged}</p>
                    {f.excerpt && (
                      <blockquote className="lb-quote">
                        “{f.excerpt}”{f.pageNumber ? <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Page {f.pageNumber}</span> : null}
                      </blockquote>
                    )}
                    <p style={{ marginTop: 8, fontSize: '0.875rem' }}>{f.guidance}</p>
                    <Link to={`/connect/find?specialization=${encodeURIComponent(f.specialization)}`} className="btn btn-secondary btn-sm" style={{ marginTop: 10 }}>
                      <ExternalLink size={14} /> Find a lawyer for this
                    </Link>
                  </article>
                ))}
              </div>
            )}
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 14 }}>{data.compliance.disclaimer}</p>
          </section>
        </div>
      )}
    </div>
  );
};
