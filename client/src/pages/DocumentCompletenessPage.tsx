import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, XCircle, Info, Check, FileCheck } from 'lucide-react';
import ApiService from '../services/api.js';
import { DocumentRecord, CompletenessCheck } from '../types/index.js';
import { DocumentNavHeader } from '../components/document/DocumentNavHeader.js';

export const DocumentCompletenessPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [checks, setChecks] = useState<CompletenessCheck[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchData = async () => {
    if (!id) return;
    try {
      const [docRes, compRes] = await Promise.all([
        ApiService.getDocumentById(id),
        ApiService.getCompleteness(id),
      ]);
      setDocument(docRes.document);
      setChecks(compRes.checks);
    } catch (err) {
      console.error('Failed to load completeness checks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id]);

  const handleToggleReview = async (checkId: string, currentStatus: boolean) => {
    if (!id) return;
    setUpdatingId(checkId);
    try {
      const res = await ApiService.toggleCompletenessReview(id, checkId, !currentStatus);
      setChecks((prev) => prev.map((c) => (c.id === checkId ? { ...c, isReviewed: res.check.isReviewed } : c)));
    } catch (err: any) {
      alert(`Failed to update: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const foundCount = checks.filter((c) => c.status === 'FOUND').length;
  const needsReviewCount = checks.filter((c) => c.status === 'NEEDS_REVIEW').length;
  const notFoundCount = checks.filter((c) => c.status === 'NOT_FOUND').length;

  return (
    <div style={{ width: '100%', margin: '0' }} className="animate-fade-in">
      <DocumentNavHeader document={document} />

      {/* Overview */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-header">
          <div>
            <h2>Completeness Checklist</h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '3px' }}>
              Audit against standard commercial contract requirements
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span className="badge badge-success">
              <CheckCircle2 size={11} /> {foundCount} Found
            </span>
            <span className="badge badge-warning">
              <AlertTriangle size={11} /> {needsReviewCount} Needs Review
            </span>
            <span className="badge badge-danger">
              <XCircle size={11} /> {notFoundCount} Not Found
            </span>
          </div>
        </div>

        <div className="alert alert-info" style={{ fontSize: '0.8125rem' }}>
          <Info size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
          <p style={{ lineHeight: 1.6 }}>
            <strong>Notice:</strong> A "Not Found" result means standard boilerplate language was not detected in the document scan. It does not automatically invalidate the contract.
          </p>
        </div>
      </div>

      {/* Checklist */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
          <div className="spinner" />
        </div>
      ) : checks.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon"><FileCheck size={20} /></div>
            <h3>No checklist items generated</h3>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {checks.map((item) => {
            const isFound = item.status === 'FOUND';
            const isReview = item.status === 'NEEDS_REVIEW';
            const borderColor = item.isReviewed ? 'var(--border)' : isFound ? 'var(--border)' : isReview ? '#ead99b' : '#f5c6c3';
            const bgColor = item.isReviewed ? 'var(--success-bg)' : isFound ? 'var(--white)' : isReview ? 'var(--warning-bg)' : 'var(--danger-bg)';

            return (
              <div
                key={item.id}
                style={{
                  background: bgColor,
                  border: `1px solid ${borderColor}`,
                  borderRadius: 'var(--radius)',
                  padding: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1, minWidth: 0 }}>
                    <div style={{ marginTop: '1px', flexShrink: 0 }}>
                      {isFound ? (
                        <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
                      ) : isReview ? (
                        <AlertTriangle size={18} style={{ color: 'var(--warning)' }} />
                      ) : (
                        <XCircle size={18} style={{ color: 'var(--danger)' }} />
                      )}
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                        <h4 style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                          {item.expectedSection}
                        </h4>
                        {item.pageNumber && (
                          <span className="badge badge-default">Page {item.pageNumber}</span>
                        )}
                        {item.isReviewed && (
                          <span className="badge badge-success">Reviewed</span>
                        )}
                      </div>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        {item.reason}
                      </p>

                      {item.excerpt && (
                        <div
                          style={{
                            marginTop: '10px',
                            padding: '10px 12px',
                            background: 'rgba(255,255,255,0.7)',
                            borderRadius: 'var(--radius)',
                            border: '1px solid var(--border)',
                            fontSize: '0.8125rem',
                            color: 'var(--text-secondary)',
                            fontStyle: 'italic',
                            lineHeight: 1.6,
                          }}
                        >
                          "{item.excerpt}"
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleReview(item.id, item.isReviewed)}
                    disabled={updatingId === item.id}
                    className={`btn btn-sm ${item.isReviewed ? 'btn-primary' : ''}`}
                    style={{ flexShrink: 0 }}
                  >
                    <Check size={12} />
                    {item.isReviewed ? 'Reviewed' : 'Mark Reviewed'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
