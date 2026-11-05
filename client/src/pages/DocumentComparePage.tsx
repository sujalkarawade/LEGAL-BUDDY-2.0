import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { GitCompare } from 'lucide-react';
import ApiService from '../services/api.js';
import { InsightsApi } from '../services/insightsApi.js';
import { DocumentNavHeader } from '../components/document/DocumentNavHeader.js';
import type { DocumentRecord, DocumentTemplate } from '../types/index.js';
import type { CompareResult } from '../types/insights.js';

const STATUS = {
  PRESENT: { label: 'Present', cls: 'badge-success' },
  DIFFERENT_WORDING: { label: 'Different wording', cls: 'badge-warning' },
  MISSING: { label: 'Missing', cls: 'badge-danger' },
} as const;

export const DocumentComparePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [result, setResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    ApiService.getDocumentById(id).then(r => setDocument(r.document)).catch(() => undefined);
    ApiService.getTemplates().then(r => setTemplates(r.templates)).catch(e => setError(e.message));
  }, [id]);

  const run = async (tid: string) => {
    setTemplateId(tid);
    setResult(null);
    if (!tid || !id) return;
    setLoading(true); setError(null);
    try { setResult(await InsightsApi.compare(id, tid)); } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="animate-fade-in" style={{ width: '100%' }}>
      <DocumentNavHeader document={document} />
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div className="page-header-text">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}><GitCompare size={22} /> Compare with a standard template</h1>
          <p>See which sections of a Legal Buddy template appear in this contract, appear with different wording, or are missing.</p>
        </div>
      </div>

      <section className="card" style={{ marginBottom: 16 }}>
        <label className="label" htmlFor="tpl">Standard template</label>
        <select id="tpl" className="input" style={{ maxWidth: 420 }} value={templateId} onChange={e => run(e.target.value)}>
          <option value="">Choose a template…</option>
          {templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
      </section>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>}

      {result && (
        <>
          <section className="lb-stat-row" style={{ marginBottom: 16 }}>
            <div className="stat-card"><span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Template sections</span><strong style={{ fontSize: '1.5rem' }}>{result.summary.total}</strong></div>
            <div className="stat-card"><span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Present</span><strong style={{ fontSize: '1.5rem', color: 'var(--success)' }}>{result.summary.present}</strong></div>
            <div className="stat-card"><span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Different wording</span><strong style={{ fontSize: '1.5rem', color: 'var(--warning)' }}>{result.summary.differentWording}</strong></div>
            <div className="stat-card"><span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Missing</span><strong style={{ fontSize: '1.5rem', color: 'var(--danger)' }}>{result.summary.missing}</strong></div>
          </section>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {result.sections.map(s => (
              <article key={s.number} className="card" style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '1rem' }}>{s.number}. {s.heading}</h3>
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{Math.round(s.coverage * 100)}% word match</span>
                    <span className={`badge ${STATUS[s.status].cls}`}>{STATUS[s.status].label}</span>
                  </span>
                </div>
                <div className="lb-progress" style={{ marginTop: 8 }}><span style={{ width: `${Math.min(100, s.coverage * 100)}%` }} /></div>
                {s.contractExcerpt && (
                  <blockquote className="lb-quote">“{s.contractExcerpt}…”{s.pageNumber ? <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Closest match: page {s.pageNumber}</span> : null}</blockquote>
                )}
                {s.missingTerms.length > 0 && (
                  <p style={{ fontSize: '0.8125rem', marginTop: 8 }}>Template terms not found nearby: {s.missingTerms.map(t => <span key={t} className="badge badge-default" style={{ marginRight: 4 }}>{t}</span>)}</p>
                )}
              </article>
            ))}
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 14 }}>{result.method}</p>
        </>
      )}
    </div>
  );
};
