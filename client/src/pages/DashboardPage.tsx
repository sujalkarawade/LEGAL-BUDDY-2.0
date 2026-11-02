import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  AlertTriangle,
  Clock,
  Upload,
  FileCode2,
  ArrowRight,
  Layers,
  Calendar,
  ChevronRight,
} from 'lucide-react';
import ApiService from '../services/api.js';
import { DashboardStats } from '../types/index.js';

export const DashboardPage: React.FC = () => {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    ApiService.getDashboardStats()
      .then((res) => setData(res))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '320px' }}>
        <div className="spinner" />
      </div>
    );
  }

  const stats = data?.stats || {
    totalDocs: 0, completedDocs: 0, totalClauses: 0,
    highRiskClauses: 0, pendingObligations: 0, totalDrafts: 0,
  };

  const isNewAccount = stats.totalDocs === 0;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }} className="animate-fade-in">
      {/* Page header */}
      <div className="page-header">
        <div className="page-header-text">
          <h1>Dashboard</h1>
          <p>Contract overview, risk metrics, and upcoming obligations</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Link to="/upload" className="btn btn-primary">
            <Upload size={14} />
            Upload Contract
          </Link>
          <Link to="/document-generator" className="btn">
            <FileCode2 size={14} />
            Draft Agreement
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p className="stat-label">Active Contracts</p>
            <FileText size={16} style={{ color: 'var(--text-muted)' }} />
          </div>
          <p className="stat-value">{stats.totalDocs}</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{stats.completedDocs} parsed</p>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p className="stat-label">Clauses Identified</p>
            <Layers size={16} style={{ color: 'var(--text-muted)' }} />
          </div>
          <p className="stat-value">{stats.totalClauses}</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>portfolio total</p>
        </div>

        <div className="stat-card" style={{ borderLeftColor: stats.highRiskClauses > 0 ? 'var(--danger)' : undefined, borderLeftWidth: stats.highRiskClauses > 0 ? '3px' : '1px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p className="stat-label" style={{ color: stats.highRiskClauses > 0 ? 'var(--danger)' : undefined }}>Needs Review</p>
            <AlertTriangle size={16} style={{ color: stats.highRiskClauses > 0 ? 'var(--danger)' : 'var(--text-muted)' }} />
          </div>
          <p className="stat-value" style={{ color: stats.highRiskClauses > 0 ? 'var(--danger)' : undefined }}>{stats.highRiskClauses}</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>high-risk clauses</p>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p className="stat-label">Pending Obligations</p>
            <Clock size={16} style={{ color: 'var(--text-muted)' }} />
          </div>
          <p className="stat-value">{stats.pendingObligations}</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>unreviewed</p>
        </div>
      </div>

      {/* Main content */}
      {isNewAccount ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">
              <Upload size={20} />
            </div>
            <h3>No contracts yet</h3>
            <p>
              Upload your first PDF agreement to generate structured summaries,
              risk-rated clause breakdowns, and completeness checklists.
            </p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <Link to="/upload" className="btn btn-primary">Upload Contract</Link>
              <Link to="/document-generator" className="btn">Generate a Draft</Link>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '16px' }}>
          {/* Recent contracts table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="card-header" style={{ padding: '16px 20px', marginBottom: 0 }}>
              <h2 style={{ fontSize: '0.9375rem' }}>Recent Contracts</h2>
              <Link
                to="/documents"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  fontSize: '0.8125rem', color: 'var(--text-secondary)', textDecoration: 'none',
                  fontWeight: 500,
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
              >
                View all ({stats.totalDocs})
                <ChevronRight size={14} />
              </Link>
            </div>

            <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.recentDocuments.map((doc) => (
                    <tr key={doc.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '32px', height: '32px', borderRadius: 'var(--radius)',
                            background: 'var(--surface-alt)', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          }}>
                            <FileText size={15} style={{ color: 'var(--text-muted)' }} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p style={{
                              fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              maxWidth: '220px',
                            }}>
                              {doc.originalName}
                            </p>
                            <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                              {(doc.fileSize / 1024).toFixed(0)} KB &bull; {new Date(doc.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-default">
                          {doc.summary?.contractType || 'General'}
                        </span>
                      </td>
                      <td>
                        {['READY', 'KEYWORD_READY'].includes(doc.ragStatus || '') ? (
                          <span className="badge badge-success">
                            <span className="status-dot status-dot-success" />
                            {doc.ragStatus === 'KEYWORD_READY' ? 'Keyword ready' : 'Ready'}
                          </span>
                        ) : doc.status === 'PROCESSING' ? (
                          <span className="badge badge-warning">
                            <span className="status-dot status-dot-warning" />
                            {doc.ragStatus === 'INDEXING' ? 'Indexing' : 'Processing'}
                          </span>
                        ) : (
                          <span className="badge badge-danger">
                            {doc.ragStatus === 'REVIEW_REQUIRED' ? 'Review required' : doc.status === 'FAILED' ? 'Failed' : 'Index required'}
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <Link to={`/documents/${doc.id}/summary`} className="btn btn-sm">Summary</Link>
                          <Link to={`/documents/${doc.id}/chat`} className="btn btn-sm">Chat</Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Upcoming obligations */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div className="card-header" style={{ padding: '16px 20px', marginBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <Calendar size={15} style={{ color: 'var(--text-muted)' }} />
                <h2 style={{ fontSize: '0.9375rem' }}>Upcoming Obligations</h2>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {data?.upcomingObligations && data.upcomingObligations.length > 0 ? (
                <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {data.upcomingObligations.map((ob) => (
                    <div
                      key={ob.id}
                      style={{
                        padding: '12px 14px',
                        background: 'var(--surface)',
                        borderRadius: 'var(--radius)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span className="badge badge-default">{ob.category}</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          {ob.dueDateOrPeriod || 'Notice-based'}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {ob.description}
                      </p>
                      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                          {ob.responsibleParty || 'Specified party'}
                        </span>
                        <Link
                          to={`/documents/${ob.documentId}/obligations`}
                          style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none' }}
                          onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                          onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                        >
                          View →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state" style={{ padding: '32px 16px' }}>
                  <p style={{ fontSize: '0.8125rem' }}>No pending obligations</p>
                  <p style={{ fontSize: '0.75rem' }}>Upload an agreement to scan deadlines</p>
                </div>
              )}
            </div>

            {/* Generator prompt */}
            <div style={{ padding: '12px', borderTop: '1px solid var(--border)' }}>
              <Link
                to="/document-generator"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px', background: 'var(--surface)', borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)', textDecoration: 'none',
                  transition: 'background var(--transition)',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-alt)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileCode2 size={15} style={{ color: 'var(--text-muted)' }} />
                  <div>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>Need a new contract?</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Generate NDAs, MSAs & Offers</p>
                  </div>
                </div>
                <ArrowRight size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
