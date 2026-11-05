import React, { useEffect, useState } from 'react';
import { MessageSquare, CheckCircle2, AlertTriangle } from 'lucide-react';
import { InsightsApi, type ReviewPayload } from '../../services/insightsApi.js';
import type { ClauseReviewComment } from '../../types/insights.js';

export const VerdictBadge: React.FC<{ verdict: ClauseReviewComment['verdict'] }> = ({ verdict }) =>
  verdict === 'ACCEPTABLE' ? <span className="badge badge-success"><CheckCircle2 size={12} /> Acceptable</span>
    : verdict === 'NEEDS_CHANGE' ? <span className="badge badge-danger"><AlertTriangle size={12} /> Needs change</span>
      : <span className="badge badge-default"><MessageSquare size={12} /> Comment</span>;

/**
 * Clause-by-clause review thread for one consultation.
 * LAWYER mode: verdict + comment + suggested wording. USER mode: replies only.
 */
export const ClauseReviewPanel: React.FC<{ consultationId: string; mode: 'LAWYER' | 'USER' }> = ({ consultationId, mode }) => {
  const [data, setData] = useState<ReviewPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { verdict: string; comment: string; suggestedText: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    (mode === 'LAWYER' ? InsightsApi.lawyerReview(consultationId) : InsightsApi.userReview(consultationId))
      .then(setData).catch(e => setError(e.message));
  }, [consultationId, mode]);

  const draft = (clauseId: string) => drafts[clauseId] || { verdict: 'COMMENT', comment: '', suggestedText: '' };
  const setDraft = (clauseId: string, patch: Partial<{ verdict: string; comment: string; suggestedText: string }>) =>
    setDrafts(d => ({ ...d, [clauseId]: { ...draft(clauseId), ...patch } }));

  const submit = async (clauseId: string) => {
    const d = draft(clauseId);
    if (d.comment.trim().length < 2) return;
    setBusy(clauseId); setError(null);
    try {
      const next = mode === 'LAWYER'
        ? await InsightsApi.lawyerAddReview(consultationId, { clauseFindingId: clauseId, verdict: d.verdict, comment: d.comment, ...(d.suggestedText.trim() ? { suggestedText: d.suggestedText } : {}) })
        : await InsightsApi.userReply(consultationId, clauseId, d.comment);
      setData(prev => ({ ...next, reviewOpen: prev?.reviewOpen ?? next.reviewOpen }));
      setDrafts(x => ({ ...x, [clauseId]: { verdict: 'COMMENT', comment: '', suggestedText: '' } }));
    } catch (e: any) { setError(e.message); }
    finally { setBusy(null); }
  };

  if (error && !data) return <div className="alert alert-warning" style={{ marginTop: 12 }}>{error}</div>;
  if (!data) return <div style={{ padding: 16 }}><div className="spinner" /></div>;
  const canWrite = mode === 'LAWYER' || data.reviewOpen !== false;

  return (
    <div className="lb-review-panel">
      {error && <div className="alert alert-error">{error}</div>}
      {data.clauses.length === 0 && <p>Legal Buddy did not record clause findings for this document.</p>}
      {data.clauses.map(clause => {
        const thread = data.comments.filter(c => c.clauseFindingId === clause.id);
        const d = draft(clause.id);
        return (
          <article key={clause.id} className="lb-review-clause">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <strong style={{ color: 'var(--text-primary)' }}>{clause.title}</strong>
              <span className="badge badge-default">{clause.category} · {clause.riskLevel}{clause.pageNumber ? ` · p.${clause.pageNumber}` : ''}</span>
            </div>
            <blockquote className="lb-quote">“{clause.excerpt}”</blockquote>
            {clause.potentialConcern && <p style={{ fontSize: '0.8125rem' }}><strong>Legal Buddy noted:</strong> {clause.potentialConcern}</p>}

            {thread.map(c => (
              <div key={c.id} className="lb-review-comment" data-role={c.authorRole}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '0.8125rem' }}>{c.authorRole === 'LAWYER' ? 'Lawyer' : 'Client'}</strong>
                  {c.authorRole === 'LAWYER' && <VerdictBadge verdict={c.verdict} />}
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(c.createdAt).toLocaleString()}</span>
                </div>
                <p style={{ whiteSpace: 'pre-line', color: 'var(--text-primary)', marginTop: 4 }}>{c.comment}</p>
                {c.suggestedText && <div className="lb-suggested"><span className="section-label">Suggested wording</span><p style={{ whiteSpace: 'pre-line' }}>{c.suggestedText}</p></div>}
              </div>
            ))}

            {canWrite && (
              <div className="lb-review-form">
                {mode === 'LAWYER' && (
                  <select className="input" aria-label="Verdict" value={d.verdict} onChange={e => setDraft(clause.id, { verdict: e.target.value })}>
                    <option value="COMMENT">Comment</option>
                    <option value="ACCEPTABLE">Acceptable as written</option>
                    <option value="NEEDS_CHANGE">Needs change</option>
                  </select>
                )}
                <textarea className="input" rows={2} maxLength={2000} placeholder={mode === 'LAWYER' ? 'Your comment for the client' : 'Reply to your lawyer'} value={d.comment} onChange={e => setDraft(clause.id, { comment: e.target.value })} />
                {mode === 'LAWYER' && d.verdict === 'NEEDS_CHANGE' && (
                  <textarea className="input" rows={2} maxLength={3000} placeholder="Suggested replacement wording (optional)" value={d.suggestedText} onChange={e => setDraft(clause.id, { suggestedText: e.target.value })} />
                )}
                <button type="button" className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }} disabled={busy === clause.id || d.comment.trim().length < 2} onClick={() => submit(clause.id)}>
                  {busy === clause.id ? 'Saving…' : mode === 'LAWYER' ? 'Add review' : 'Reply'}
                </button>
              </div>
            )}
          </article>
        );
      })}
      {!canWrite && <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>This review is closed (sharing was revoked or the request ended).</p>}
    </div>
  );
};
