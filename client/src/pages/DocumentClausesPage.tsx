import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  SearchCode,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Filter,
  Info,
  ChevronDown,
} from 'lucide-react';
import ApiService from '../services/api.js';
import { DocumentRecord, ClauseFinding } from '../types/index.js';
import { DocumentNavHeader } from '../components/document/DocumentNavHeader.js';

export const DocumentClausesPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [clauses, setClauses] = useState<ClauseFinding[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [updatingClauseId, setUpdatingClauseId] = useState<string | null>(null);

  const fetchData = async () => {
    if (!id) return;
    try {
      const [docRes, clauseRes] = await Promise.all([
        ApiService.getDocumentById(id),
        ApiService.getClauses(id, categoryFilter, riskFilter),
      ]);
      setDocument(docRes.document);
      setClauses(clauseRes.clauses);
    } catch (err) {
      console.error('Failed to load clauses:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id, categoryFilter, riskFilter]);

  const handleStatusUpdate = async (clauseId: string, newStatus: string) => {
    if (!id) return;
    setUpdatingClauseId(clauseId);
    try {
      const res = await ApiService.updateClauseStatus(id, clauseId, newStatus);
      setClauses((prev) =>
        prev.map((c) => (c.id === clauseId ? { ...c, reviewStatus: res.clause.reviewStatus } : c))
      );
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    } finally {
      setUpdatingClauseId(null);
    }
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'High':
        return (
          <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <AlertTriangle size={12} />
            High Risk
          </span>
        );
      case 'Medium':
        return (
          <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <AlertTriangle size={12} />
            Medium Risk
          </span>
        );
      case 'Needs Review':
        return (
          <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <HelpCircle size={12} />
            Needs Review
          </span>
        );
      default:
        return (
          <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle size={12} />
            Low Risk
          </span>
        );
    }
  };

  const categories = [
    'ALL',
    'Payment',
    'Termination',
    'Confidentiality',
    'Liability',
    'Intellectual Property',
    'Governing Law',
    'Dispute Resolution',
    'Renewal',
    'Penalties',
  ];

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <DocumentNavHeader document={document} />

      {/* Filter and Overview Card */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header" style={{ marginBottom: '14px', paddingBottom: '12px' }}>
          <div>
            <h2 style={{ fontSize: '1.0625rem' }}>Clause Analysis & Risk Assessment</h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Categorized contract clauses, plain-language translations, and review checkpoints
            </p>
          </div>
          <span className="badge badge-default" style={{ fontSize: '0.75rem' }}>
            {clauses.length} {clauses.length === 1 ? 'clause' : 'clauses'} identified
          </span>
        </div>

        {/* Filter Controls */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginRight: '4px' }}>
              <Filter size={13} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Category:
              </span>
            </div>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className="btn btn-sm"
                style={{
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  background: categoryFilter === cat ? 'var(--black)' : 'var(--white)',
                  color: categoryFilter === cat ? 'var(--white)' : 'var(--text-secondary)',
                  borderColor: categoryFilter === cat ? 'var(--black)' : 'var(--border)',
                }}
              >
                {cat === 'ALL' ? 'All' : cat}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Risk:
            </span>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="select"
              style={{ width: 'auto', padding: '5px 10px', fontSize: '0.8125rem' }}
            >
              <option value="ALL">All Risk Levels</option>
              <option value="High">High Risk</option>
              <option value="Medium">Medium Risk</option>
              <option value="Low">Low Risk</option>
              <option value="Needs Review">Needs Review</option>
            </select>
          </div>
        </div>
      </div>

      {/* Safeguard Notice */}
      <div className="alert alert-info" style={{ marginBottom: '20px' }}>
        <Info size={16} style={{ flexShrink: 0 }} />
        <p style={{ fontSize: '0.8125rem', lineHeight: 1.5 }}>
          Risk indicators are automated checks to assist human contract review. They do not constitute formal legal counsel or statutory advice.
        </p>
      </div>

      {/* Clauses List */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '240px' }}>
          <div className="spinner" />
        </div>
      ) : clauses.length === 0 ? (
        <div className="card empty-state" style={{ padding: '48px 20px', textAlign: 'center' }}>
          <div className="empty-state-icon">
            <SearchCode size={22} />
          </div>
          <h3>No clauses matching filters</h3>
          <p>Try switching to "All" categories or risk levels to view all detected provisions.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {clauses.map((clause) => (
            <div key={clause.id} className="card" style={{ padding: '20px' }}>
              {/* Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '12px',
                  paddingBottom: '14px',
                  marginBottom: '14px',
                  borderBottom: '1px solid var(--border)',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span className="badge badge-default">{clause.category}</span>
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{clause.title}</h3>
                  {clause.pageNumber && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Page {clause.pageNumber}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {getRiskBadge(clause.riskLevel)}

                  {/* Review Status Segmented Control */}
                  <div
                    style={{
                      display: 'inline-flex',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      overflow: 'hidden',
                      background: 'var(--surface)',
                    }}
                  >
                    {[
                      { key: 'APPROVED', label: 'Approved', activeBg: 'var(--success)', activeColor: '#ffffff' },
                      { key: 'FLAGGED', label: 'Flagged', activeBg: 'var(--danger)', activeColor: '#ffffff' },
                      { key: 'PENDING', label: 'Pending', activeBg: 'var(--black)', activeColor: '#ffffff' },
                    ].map((s) => {
                      const isSelected = clause.reviewStatus === s.key;
                      return (
                        <button
                          key={s.key}
                          onClick={() => handleStatusUpdate(clause.id, s.key)}
                          disabled={updatingClauseId === clause.id}
                          style={{
                            padding: '4px 9px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            border: 'none',
                            background: isSelected ? s.activeBg : 'transparent',
                            color: isSelected ? s.activeColor : 'var(--text-secondary)',
                            cursor: 'pointer',
                            transition: 'background var(--transition)',
                          }}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Original Excerpt */}
              <div
                style={{
                  padding: '12px 14px',
                  background: 'var(--surface)',
                  borderRadius: 'var(--radius)',
                  borderLeft: '3px solid var(--border-strong)',
                  marginBottom: '14px',
                }}
              >
                <p style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.04em' }}>
                  Contract Excerpt {clause.pageNumber ? `(Page ${clause.pageNumber})` : ''}
                </p>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', lineHeight: 1.6, fontStyle: 'italic' }}>
                  "{clause.excerpt}"
                </p>
              </div>

              {/* Analysis Columns */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius)',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    Plain Language Meaning
                  </p>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {clause.plainLanguageExplanation}
                  </p>
                </div>

                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius)',
                    background: clause.potentialConcern ? 'var(--warning-bg)' : 'var(--surface)',
                    border: clause.potentialConcern ? '1px solid #f6e58d' : '1px solid var(--border)',
                  }}
                >
                  <p
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: clause.potentialConcern ? 'var(--warning)' : 'var(--text-primary)',
                      marginBottom: '4px',
                    }}
                  >
                    Potential Concern / Risk Note
                  </p>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {clause.potentialConcern || 'No notable risk patterns detected in this clause.'}
                  </p>
                </div>
              </div>

              {/* Suggested Review Question */}
              {clause.reviewQuestion && (
                <div
                  style={{
                    marginTop: '12px',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius)',
                    background: 'var(--info-bg)',
                    border: '1px solid #d0e1fd',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                  }}
                >
                  <HelpCircle size={15} style={{ color: 'var(--info)', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--info)' }}>
                      Suggested Question for Counsel:
                    </span>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', marginTop: '2px', lineHeight: 1.5 }}>
                      {clause.reviewQuestion}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
