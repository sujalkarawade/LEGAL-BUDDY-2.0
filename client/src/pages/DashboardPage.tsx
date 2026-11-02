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
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '360px' }}>
        <div className="spinner" />
      </div>
    );
  }

  const stats = data?.stats || {
    totalDocs: 0,
    completedDocs: 0,
    totalClauses: 0,
    highRiskClauses: 0,
    pendingObligations: 0,
    totalDrafts: 0,
  };

  const isNewAccount = stats.totalDocs === 0;

  return (
    <div style={{ width: '100%', margin: '0' }} className="animate-fade-in">
      {/* Page header */}
      <div className="page-header">
        <div className="page-header-text">
          <h1>Dashboard</h1>
          <p>Contract portfolio overview, automated risk rating, and deadline tracking</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Link to="/upload" className="btn btn-primary">
            <Upload size={16} />
            Upload Contract
          </Link>
          <Link to="/document-generator" className="btn btn-secondary">
            <FileCode2 size={16} />
            Draft Agreement
          </Link>
        </div>
      </div>

      {/* KPI Stat Cards (Clean, Medium/Small Minimalist Style) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '14px',
          marginBottom: '24px',
          width: '100%',
        }}
      >
        {/* KPI 1: Active Contracts */}
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p className="stat-label">Active Contracts</p>
              <p className="stat-value">{stats.totalDocs}</p>
            </div>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius)',
                background: 'var(--surface-alt)',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <FileText size={18} />
            </div>
          </div>
        </div>

        {/* KPI 2: Clauses Identified */}
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p className="stat-label">Clauses Identified</p>
              <p className="stat-value">{stats.totalClauses}</p>
            </div>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius)',
                background: 'var(--surface-alt)',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Layers size={18} />
            </div>
          </div>
        </div>

        {/* KPI 3: Needs Review */}
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p className="stat-label" style={{ color: stats.highRiskClauses > 0 ? 'var(--danger)' : undefined }}>
                Needs Review
              </p>
              <p className="stat-value" style={{ color: stats.highRiskClauses > 0 ? 'var(--danger)' : undefined }}>
                {stats.highRiskClauses}
              </p>
            </div>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius)',
                background: stats.highRiskClauses > 0 ? 'var(--danger-bg)' : 'var(--surface-alt)',
                color: stats.highRiskClauses > 0 ? 'var(--danger)' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={18} />
            </div>
          </div>
        </div>

        {/* KPI 4: Pending Obligations */}
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p className="stat-label">Pending Obligations</p>
              <p className="stat-value">{stats.pendingObligations}</p>
            </div>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius)',
                background: 'var(--surface-alt)',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Clock size={18} />
            </div>
          </div>
        </div>
      </div>

      {/* Main content - Occupying full screen with maximized cards */}
      {isNewAccount ? (
        <div className="card" style={{ padding: '48px 32px' }}>
          <div className="empty-state">
            <div className="empty-state-icon" style={{ width: '60px', height: '60px' }}>
              <Upload size={24} />
            </div>
            <h3>No contracts in repository yet</h3>
            <p>
              Upload your agreements to automatically extract clauses, flag potential liabilities,
              and build interactive AI legal query assistants.
            </p>
            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
              <Link to="/upload" className="btn btn-primary btn-lg">
                <Upload size={16} />
                Upload Contract
              </Link>
              <Link to="/document-generator" className="btn btn-secondary btn-lg">
                <FileCode2 size={16} />
                Generate Agreement Draft
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.8fr) minmax(380px, 1.2fr)',
            gap: '24px',
            width: '100%',
          }}
        >
          {/* Recent contracts table card - Expanded */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="card-header" style={{ padding: '20px 24px', marginBottom: 0 }}>
              <div>
                <h2>Recent Contracts</h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Latest agreements added to the workspace
                </p>
              </div>
              <Link
                to="/documents"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                  textDecoration: 'none',
                  fontWeight: 600,
                  transition: 'color var(--transition)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
              >
                View all ({stats.totalDocs})
                <ChevronRight size={16} />
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: 'var(--radius)',
                              background: 'var(--surface-alt)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <FileText size={18} style={{ color: 'var(--text-muted)' }} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p
                              style={{
                                fontWeight: 600,
                                fontSize: '0.875rem',
                                color: 'var(--text-primary)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: '340px',
                              }}
                            >
                              {doc.originalName}
                            </p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {(doc.fileSize / 1024).toFixed(0)} KB &bull; {new Date(doc.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-default">
                          {doc.summary?.contractType || 'General Agreement'}
                        </span>
                      </td>
                      <td>
                        {['READY', 'KEYWORD_READY'].includes(doc.ragStatus || '') ? (
                          <span className="badge badge-success">
                            <span className="status-dot status-dot-success" />
                            {doc.ragStatus === 'KEYWORD_READY' ? 'Keyword Ready' : 'Ready'}
                          </span>
                        ) : doc.status === 'PROCESSING' ? (
                          <span className="badge badge-warning">
                            <span className="status-dot status-dot-warning" />
                            {doc.ragStatus === 'INDEXING' ? 'Indexing' : 'Processing'}
                          </span>
                        ) : (
                          <span className="badge badge-danger">
                            {doc.ragStatus === 'REVIEW_REQUIRED' ? 'Review Required' : doc.status === 'FAILED' ? 'Failed' : 'Index Required'}
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <Link to={`/documents/${doc.id}/summary`} className="btn btn-sm btn-secondary">
                            Summary
                          </Link>
                          <Link to={`/documents/${doc.id}/chat`} className="btn btn-sm btn-primary">
                            Chat
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Upcoming obligations card - Expanded */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div className="card-header" style={{ padding: '20px 24px', marginBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Calendar size={18} style={{ color: 'var(--text-muted)' }} />
                <div>
                  <h2>Upcoming Obligations</h2>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Active commitments & compliance dates
                  </p>
                </div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', maxHeight: '420px' }}>
              {data?.upcomingObligations && data.upcomingObligations.length > 0 ? (
                <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {data.upcomingObligations.map((ob) => (
                    <div
                      key={ob.id}
                      style={{
                        padding: '14px 16px',
                        background: 'var(--surface)',
                        borderRadius: 'var(--radius)',
                        border: '1px solid var(--border)',
                        transition: 'border-color var(--transition)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span className="badge badge-default">{ob.category}</span>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {ob.dueDateOrPeriod || 'Notice-based'}
                        </span>
                      </div>
                      <p
                        style={{
                          fontSize: '0.875rem',
                          color: 'var(--text-primary)',
                          lineHeight: 1.55,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {ob.description}
                      </p>
                      <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {ob.responsibleParty || 'Specified Party'}
                        </span>
                        <Link
                          to={`/documents/${ob.documentId}/obligations`}
                          style={{
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          View Details →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state" style={{ padding: '40px 20px' }}>
                  <CheckCircle2 size={28} style={{ color: 'var(--text-muted)' }} />
                  <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>No pending obligations</p>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Upload an agreement to scan contract commitments</p>
                </div>
              )}
            </div>

            {/* Quick action footer */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
              <Link
                to="/document-generator"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: 'var(--white)',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  textDecoration: 'none',
                  transition: 'all var(--transition)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--text-primary)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px',
                      background: 'var(--surface-alt)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <FileCode2 size={16} style={{ color: 'var(--text-primary)' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>Need a new contract?</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Generate customized NDAs, MSAs, and employment offers</p>
                  </div>
                </div>
                <ArrowRight size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
