import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Briefcase, ArrowLeft, CheckCircle, Clock, Users, FileCheck2, Scale } from 'lucide-react';

export const LawyerLoginPage: React.FC = () => {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--surface)',
        padding: '32px 16px',
        position: 'relative',
      }}
    >
      {/* Top Left Corner Back Text Link (No container, no icon) */}
      <Link
        to="/login"
        style={{
          position: 'fixed',
          top: '24px',
          left: '24px',
          display: 'inline-block',
          fontSize: '0.875rem',
          fontWeight: 500,
          color: 'var(--text-secondary)',
          textDecoration: 'none',
          transition: 'color var(--transition)',
          zIndex: 50,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
      >
        Back to User Login
      </Link>

      <div style={{ width: '100%', maxWidth: '580px' }}>

        {/* Header (No icon) */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <span className="badge badge-warning" style={{ marginBottom: '10px' }}>
            <Clock size={12} style={{ marginRight: '4px' }} />
            Phase 2 — Under Active Development
          </span>

          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '8px' }}>
            Lawyer & Counsel Portal
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '440px', margin: '4px auto 0' }}>
            A specialized workspace for advocates, corporate legal teams, and compliance officers.
          </p>
        </div>

        {/* Content Card */}
        <div className="card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="alert alert-info" style={{ margin: 0 }}>
            <Shield size={16} style={{ flexShrink: 0 }} />
            <div>
              <p style={{ fontWeight: 600 }}>Architecture Notice</p>
              <p style={{ fontSize: '0.8125rem', marginTop: '2px', lineHeight: 1.5 }}>
                Lawyer-specific authentication and bar credential verification will be enabled in Phase 2. To ensure credential integrity, direct attorney login will activate once bar verification is connected.
              </p>
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '12px' }}>
              Planned Capabilities
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              {[
                {
                  icon: FileCheck2,
                  title: 'Formal Redlining',
                  desc: 'Direct clause revision, attorney sign-offs, and client review feedback loops.',
                },
                {
                  icon: Users,
                  title: 'Case Delegation',
                  desc: 'Portfolio sharing between enterprise clients and retained counsel.',
                },
                {
                  icon: Scale,
                  title: 'Statutory Verification',
                  desc: 'Deterministic compliance checks against statutory guidelines.',
                },
                {
                  icon: CheckCircle,
                  title: 'Legal Precedents',
                  desc: 'Integration hook for permitted high-court and appellate citations.',
                },
              ].map((feat, i) => {
                const Icon = feat.icon;
                return (
                  <div
                    key={i}
                    style={{
                      padding: '14px',
                      background: 'var(--surface)',
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <Icon size={16} style={{ color: 'var(--text-primary)' }} />
                      <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {feat.title}
                      </p>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {feat.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            style={{
              paddingTop: '16px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <Link
              to="/login"
              className="btn btn-primary"
              style={{ flex: 1, textAlign: 'center', justifyContent: 'center' }}
            >
              Sign In to User Account
            </Link>
            <Link
              to="/dashboard"
              className="btn btn-secondary"
              style={{ textAlign: 'center', justifyContent: 'center' }}
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
