import React from 'react';
import { useAuth } from '../context/AuthContext.js';
import { Building, Mail, Calendar, CheckCircle2 } from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { user } = useAuth();

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'LB';

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto' }} className="animate-fade-in">
      <div className="page-header">
        <div className="page-header-text">
          <h1>Profile & Settings</h1>
          <p>Account information and system configuration</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {/* User account */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
            <div
              style={{
                width: '48px', height: '48px', borderRadius: '50%',
                background: 'var(--black)', color: 'var(--white)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: '1rem', flexShrink: 0,
              }}
            >
              {initials}
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{user?.name}</p>
              <span className="badge badge-default" style={{ marginTop: '4px' }}>{user?.role || 'User'}</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {[
              { icon: Mail,     label: 'Email',        value: user?.email },
              { icon: Building, label: 'Organization', value: user?.organization || 'Independent' },
              { icon: Calendar, label: 'Member since', value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Active' },
            ].map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 0', borderBottom: '1px solid var(--border)',
                  fontSize: '0.875rem',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontWeight: 500 }}>
                  <Icon size={14} />
                  {label}
                </span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* System status */}
        <div className="card">
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '16px' }}>System Status</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ padding: '12px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <p className="section-label" style={{ marginBottom: '4px' }}>Document Analysis</p>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>Local Rule-Based Processing</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>Deterministic NLP engine active</p>
            </div>

            <div style={{ padding: '12px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <p className="section-label" style={{ marginBottom: '4px' }}>Database</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <CheckCircle2 size={15} style={{ color: 'var(--success)' }} />
                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>PostgreSQL 17 Connected</p>
              </div>
            </div>

            <div style={{ padding: '12px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <p className="section-label" style={{ marginBottom: '4px' }}>RAG Engine</p>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>Hybrid BM25 + Cosine Search</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>Retrieval-Augmented Generation enabled</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
